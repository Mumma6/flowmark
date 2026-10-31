import { randomUUID } from "node:crypto"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import {
  createDatabase,
  projects,
  projectApiKeys,
  workspaces,
  workflowEvents,
  workflowRuns,
  workflows,
} from "@flowmark/db"
import { eq } from "drizzle-orm"
import { hashApiKey } from "@flowmark/db/persistence"
import { createFlowmark } from "../../../../packages/sdk/src/index.js"
import { POST } from "../../app/v1/events/route"
import { appRouter } from "../../src/adapters/trpc"

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  "safe mapped operation failures through SDK/HTTP/storage",
  () => {
    const projectId = randomUUID(),
      workspaceId = randomUUID(),
      writeKey = randomUUID(),
      readKey = randomUUID()
    let connection: ReturnType<typeof createDatabase>
    beforeAll(async () => {
      vi.stubEnv("DATABASE_URL", process.env.TEST_DATABASE_URL!)
      vi.stubEnv("FLOWMARK_DEMO_MODE", "false")
      connection = createDatabase(process.env.TEST_DATABASE_URL!)
      await connection.db
        .insert(workspaces)
        .values({ id: workspaceId, name: "Safe error test workspace" })
      await connection.db
        .insert(projects)
        .values({ id: projectId, workspaceId, name: "Mapped CRM verification" })
      await connection.db.insert(projectApiKeys).values([
        { projectId, keyHash: hashApiKey(writeKey), permission: "write" },
        { projectId, keyHash: hashApiKey(readKey), permission: "read" },
      ])
    })
    afterAll(async () => {
      await connection?.close()
      vi.unstubAllGlobals()
      vi.unstubAllEnvs()
    })
    it("stores only mapped code/message/retryability, preserves the original cause and permits partial recovery", async () => {
      const envelopes: unknown[] = []
      vi.stubGlobal(
        "fetch",
        async (input: RequestInfo | URL, init?: RequestInit) => {
          const request = new Request(input, init)
          envelopes.push(await request.clone().json())
          return POST(request)
        },
      )
      const diagnostic = vi.fn()
      const client = createFlowmark({
        apiKey: writeKey,
        apiUrl: "http://localhost",
        onInstrumentationError: diagnostic,
      })
      const flow = client.workflow("crm.import.safe-errors")
      // Expected domain rejections are business evidence, rather than technical exceptions.
      flow.report({ imported: 3, rejected: 2, reasons: { invalid_email: 2 } })
      const original = new Error("SYNTHETIC_PROVIDER_TOKEN_008_do_not_store")
      await expect(
        flow.operation("crm-request", () => Promise.reject(original), {
          mapError: () => ({
            code: "CRM_UNAVAILABLE",
            message: "CRM temporarily unavailable",
            retryable: true,
            stack: "SYNTHETIC_PROVIDER_TOKEN_008_do_not_store",
          }),
        }),
      ).rejects.toBe(original)
      flow.done({
        outcome: "partial",
        result: {
          imported: 3,
          rejected: 2,
          failed: 1,
          reasons: { invalid_email: 2 },
        },
      })
      await client.shutdown()
      expect(diagnostic).not.toHaveBeenCalled()
      expect(JSON.stringify(envelopes)).not.toContain(
        "SYNTHETIC_PROVIDER_TOKEN_008",
      )
      const api = appRouter.createCaller({
        request: new Request("http://localhost/api/trpc", {
          headers: { authorization: `Bearer ${readKey}` },
        }),
      })
      const page = await api.run.list({
        workflow: "crm.import.safe-errors",
        externalId: flow.runId,
      })
      expect(page.runs[0]).toMatchObject({
        status: "Completed",
        outcome: "partial",
        result: { imported: 3, rejected: 2, failed: 1 },
      })
      const timeline = await api.run.detail({ id: page.runs[0].id })
      expect(
        timeline.find((event) => event.type === "operation_failed"),
      ).toMatchObject({
        error: {
          code: "CRM_UNAVAILABLE",
          message: "CRM temporarily unavailable",
          retryable: true,
        },
      })
      const stored = await connection.db
        .select()
        .from(workflowEvents)
        .innerJoin(workflowRuns, eq(workflowEvents.runId, workflowRuns.id))
        .innerJoin(workflows, eq(workflowRuns.workflowId, workflows.id))
        .where(eq(workflows.projectId, projectId))
      expect(JSON.stringify(stored)).not.toContain(
        "SYNTHETIC_PROVIDER_TOKEN_008",
      )
      expect(JSON.stringify(timeline)).not.toContain(
        "SYNTHETIC_PROVIDER_TOKEN_008",
      )
    })
  },
)
