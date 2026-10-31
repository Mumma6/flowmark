import { POST as browserPOST } from "../../app/v1/browser-events/route"
import { randomUUID } from "node:crypto"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import {
  createDatabase,
  projects,
  projectApiKeys,
  projectBrowserKeys,
  workspaces,
} from "@flowmark/db"
import { hashApiKey } from "@flowmark/db/persistence"
import { createFlowmark } from "../../../../packages/sdk/src/index.js"
import { POST } from "../../app/v1/events/route"
import { appRouter } from "../../src/adapters/trpc"

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  "explicit attempts through SDK/HTTP/storage",
  () => {
    const publicKey = `fm_browser_${randomUUID()}`,
      origin = "http://localhost:5173"
    const projectId = randomUUID(),
      otherProjectId = randomUUID(),
      workspaceId = randomUUID()
    const writeKey = randomUUID(),
      readKey = randomUUID(),
      otherWriteKey = randomUUID(),
      otherReadKey = randomUUID()
    let connection: ReturnType<typeof createDatabase>
    beforeAll(async () => {
      vi.stubEnv("DATABASE_URL", process.env.TEST_DATABASE_URL!)
      vi.stubEnv("FLOWMARK_DEMO_MODE", "false")
      connection = createDatabase(process.env.TEST_DATABASE_URL!)
      await connection.db
        .insert(workspaces)
        .values({ id: workspaceId, name: "Attempt verification workspace" })
      await connection.db.insert(projects).values([
        { id: projectId, workspaceId, name: "Explicit CRM attempts" },
        { id: otherProjectId, workspaceId, name: "Isolated attempts" },
      ])
      await connection.db.insert(projectBrowserKeys).values({
        projectId,
        keyHash: hashApiKey(publicKey),
        allowedOrigins: [origin],
      })
      await connection.db.insert(projectApiKeys).values([
        { projectId, keyHash: hashApiKey(writeKey), permission: "write" },
        { projectId, keyHash: hashApiKey(readKey), permission: "read" },
        {
          projectId: otherProjectId,
          keyHash: hashApiKey(otherWriteKey),
          permission: "write",
        },
        {
          projectId: otherProjectId,
          keyHash: hashApiKey(otherReadKey),
          permission: "read",
        },
      ])
    })
    afterAll(async () => {
      await connection?.close()
      vi.unstubAllGlobals()
      vi.unstubAllEnvs()
    })
    const caller = (key = readKey) =>
      appRouter.createCaller({
        request: new Request("http://localhost/api/trpc", {
          headers: { authorization: `Bearer ${key}` },
        }),
      })
    const send = (event: unknown, eventId = randomUUID(), key = writeKey) =>
      POST(
        new Request("http://localhost/v1/events", {
          method: "POST",
          headers: { authorization: `Bearer ${key}` },
          body: JSON.stringify({ eventId, event }),
        }),
      )
    const find = async (workflow: string, externalId: string, key = readKey) =>
      (await caller(key).run.list({ workflow, externalId })).runs[0]!

    it("qualifies browser retry references and rejects normalized self references", async () => {
      const timestamp = new Date().toISOString()
      const browserSend = (event: unknown) =>
        browserPOST(
          new Request("http://localhost/v1/browser-events", {
            method: "POST",
            headers: { authorization: `Bearer ${publicKey}`, origin },
            body: JSON.stringify({ eventId: randomUUID(), event }),
          }),
        )
      expect(
        (
          await browserSend({
            type: "started",
            workflow: "attempts.browser",
            runId: "earlier",
            timestamp,
          })
        ).status,
      ).toBe(202)
      expect(
        (
          await browserSend({
            type: "started",
            workflow: "attempts.browser",
            runId: "later",
            timestamp,
            retryOf: { workflow: "attempts.browser", runId: "earlier" },
          })
        ).status,
      ).toBe(202)
      const current = await find("browser.attempts.browser", "later")
      expect(
        (await caller().run.detail({ id: current.id }))[0]?.retryOf,
      ).toEqual({ workflow: "browser.attempts.browser", runId: "earlier" })
      expect(
        (await caller().run.related({ id: current.id })).retryMatches,
      ).toMatchObject([
        { workflow: "browser.attempts.browser", externalId: "earlier" },
      ])
      expect(
        (
          await browserSend({
            type: "started",
            workflow: "attempts.browser",
            runId: "self",
            timestamp,
            retryOf: { workflow: "browser.attempts.browser", runId: "self" },
          })
        ).status,
      ).toBe(400)
    })

    it("persists application-controlled failure and recovery without changing the earlier run's status or item counts", async () => {
      vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) =>
        POST(new Request(input, init)),
      )
      const client = createFlowmark({
        apiUrl: "http://localhost",
        apiKey: writeKey,
      })
      const first = client.workflow("crm.attempts", { id: "crm-first" })
      const failed = first.operation("push-to-crm", {
        attempt: { groupId: "batch-A", number: 1 },
      })
      failed.fail({ code: "CRM_UNAVAILABLE", retryable: true })
      first.fail({
        code: "CRM_UNAVAILABLE",
        outcome: "partial",
        result: { imported: 2, remaining: 1 },
      })
      await client.flush()
      const retry = client
        .defineWorkflow<{ batchId: string }, { imported: number }, "complete">(
          "crm.attempts",
        )
        .start({
          properties: { batchId: "batch-A" },
          id: "crm-retry",
          retryOf: { workflow: "crm.attempts", runId: first.runId },
        })
      const failedAgain = new Error("Synthetic CRM outage")
      await expect(
        retry.operation("push-to-crm", () => Promise.reject(failedAgain), {
          attempt: { groupId: "remaining", number: 1 },
          mapError: () => ({ code: "CRM_UNAVAILABLE" }),
        }),
      ).rejects.toBe(failedAgain)
      await retry.operation("push-to-crm", () => Promise.resolve(1), {
        attempt: { groupId: "remaining", number: 2 },
      })
      // Repeated pages remain ordinary occurrences, never inferred retries.
      retry.operation("page").done()
      retry.operation("page").done()
      retry.done({ outcome: "complete", result: { imported: 1 } })
      await client.shutdown()
      const previous = await find("crm.attempts", first.runId)
      const current = await find("crm.attempts", retry.runId)
      expect(previous).toMatchObject({
        status: "Failed",
        result: { imported: 2, remaining: 1 },
      })
      expect(current).toMatchObject({
        status: "Completed",
        result: { imported: 1 },
      })
      const timeline = await caller().run.detail({ id: current.id })
      expect(timeline[0]).toMatchObject({
        retryOf: { workflow: "crm.attempts", runId: first.runId },
      })
      expect(
        timeline.filter((event) => event.type === "operation_failed"),
      ).toMatchObject([{ attempt: { groupId: "remaining", number: 1 } }])
      expect(
        timeline.filter(
          (event) =>
            event.type === "operation_completed" &&
            event.operationName === "push-to-crm",
        ),
      ).toMatchObject([{ attempt: { groupId: "remaining", number: 2 } }])
      expect(
        timeline
          .filter((event) => event.operationName === "page")
          .every((event) => event.attempt === null),
      ).toBe(true)
      expect(
        (await caller().run.related({ id: current.id })).retryMatches,
      ).toMatchObject([{ id: previous.id, status: "Failed" }])
      expect(
        (await caller().run.related({ id: previous.id })).retries,
      ).toMatchObject([{ id: current.id, status: "Completed" }])
      expect(
        await caller(otherReadKey).run.related({ id: current.id }),
      ).toEqual({ parentMatches: [], related: [] })
      vi.unstubAllGlobals()
    })

    it("deduplicates envelopes, preserves out-of-order and missing attempts and rejects conflicting group ordinals", async () => {
      const base = {
        workflow: "attempt.arrival",
        runId: "arrival",
        timestamp: new Date().toISOString(),
      }
      expect((await send({ ...base, type: "started" })).status).toBe(202)
      const operationId = randomUUID(),
        eventId = randomUUID()
      const terminal = {
        ...base,
        type: "operation_failed",
        operationId,
        operationName: "push",
        durationMs: 25,
        failure: { code: "CRM_UNAVAILABLE" },
        attempt: { groupId: "batch", number: 3 },
      }
      expect((await send(terminal, eventId)).status).toBe(202)
      expect(await (await send(terminal, eventId)).json()).toMatchObject({
        disposition: "duplicate",
        capabilities: expect.arrayContaining(["attempts-v1"]),
      })
      expect(
        (
          await send({
            ...base,
            type: "operation_started",
            operationId,
            operationName: "push",
            attempt: { groupId: "batch", number: 3 },
          })
        ).status,
      ).toBe(202)
      expect(
        (await send({ ...terminal, operationId: randomUUID() })).status,
      ).toBe(409)
      expect(
        (await send({ ...terminal, attempt: { groupId: "batch", number: 4 } }))
          .status,
      ).toBe(409)
      expect((await send({ ...terminal, attempt: undefined })).status).toBe(409)
      const terminalOnly = {
        ...terminal,
        operationId: randomUUID(),
        attempt: { groupId: "batch", number: 5 },
        type: "operation_completed",
        failure: undefined,
      }
      expect((await send(terminalOnly)).status).toBe(202)
      // Groups belong to the logical operation, rather than globally to all names.
      expect(
        (
          await send({
            ...terminalOnly,
            operationId: randomUUID(),
            operationName: "other-push",
            attempt: { groupId: "batch", number: 3 },
          })
        ).status,
      ).toBe(202)
      const run = await find(base.workflow, base.runId)
      const timeline = await caller().run.detail({ id: run.id })
      expect(timeline).toHaveLength(5)
      expect(
        timeline.filter((event) => event.operationId === operationId),
      ).toHaveLength(2)
      expect(
        timeline.find((event) => event.operationId === terminalOnly.operationId)
          ?.attempt?.number,
      ).toBe(5)
    })

    it("resolves only qualified same-project retry references, including delayed predecessors", async () => {
      const timestamp = new Date().toISOString()
      expect(
        (
          await send({
            type: "started",
            workflow: "booking.retry",
            runId: "later",
            timestamp,
            retryOf: { workflow: "booking.create", runId: "shared" },
          })
        ).status,
      ).toBe(202)
      const current = await find("booking.retry", "later")
      expect(
        (await caller().run.related({ id: current.id })).retryMatches ?? [],
      ).toEqual([])
      expect(
        (
          await send(
            {
              type: "started",
              workflow: "booking.create",
              runId: "shared",
              timestamp,
            },
            randomUUID(),
            otherWriteKey,
          )
        ).status,
      ).toBe(202)
      expect(
        (
          await send({
            type: "started",
            workflow: "unrelated",
            runId: "shared",
            timestamp,
          })
        ).status,
      ).toBe(202)
      expect(
        (await caller().run.related({ id: current.id })).retryMatches ?? [],
      ).toEqual([])
      expect(
        (
          await send({
            type: "started",
            workflow: "booking.create",
            runId: "shared",
            timestamp,
          })
        ).status,
      ).toBe(202)
      const predecessor = await find("booking.create", "shared")
      expect(
        (await caller().run.related({ id: current.id })).retryMatches,
      ).toMatchObject([{ id: predecessor.id, workflow: "booking.create" }])
      const other = await find("booking.create", "shared", otherReadKey)
      expect(
        (await caller(otherReadKey).run.related({ id: other.id })).retries ??
          [],
      ).toEqual([])
      expect(
        (
          await send({
            type: "started",
            workflow: "booking.retry",
            runId: "later",
            timestamp,
            retryOf: { workflow: "unrelated", runId: "shared" },
          })
        ).status,
      ).toBe(202)
      expect(
        (await caller().run.detail({ id: current.id }))[0]?.retryOf?.workflow,
      ).toBe("booking.create")
    })
  },
)
