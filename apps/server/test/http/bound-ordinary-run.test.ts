import { createHash, randomBytes, randomUUID } from "node:crypto"
import { Exit } from "effect"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import {
  GetProjectWorkflowData,
  Key,
  rankChangeMappings,
  runApi,
} from "@flowmark/api"
import {
  createDatabase,
  deploymentBindings,
  projectApiKeys,
  projects,
  workspaces,
} from "@flowmark/db"
import { hashApiKey } from "@flowmark/db/persistence"
import { createFlowmark } from "../../../../packages/sdk/src/index.js"
import { POST as deployment } from "../../app/v1/deployments/route"
import { POST as ingest } from "../../app/v1/events/route"

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  "ordinary workflow bound to its deployment",
  () => {
    const projectId = randomUUID()
    const workspaceId = randomUUID()
    const bindingId = randomUUID()
    const writeKey = randomUUID()
    const readKey = randomUUID()
    const token = "fmd_" + randomBytes(32).toString("hex")
    const deploymentId = "fixture-" + randomUUID()
    const artifactDigest = "sha256:" + "c".repeat(64)
    const otherDigest = "sha256:" + "d".repeat(64)
    const sourceRevision = "a".repeat(40)
    const boundRunId = randomUUID()
    const unknownRunId = randomUUID()
    const reader = Key({ header: `Bearer ${readKey}` })
    let connection: ReturnType<typeof createDatabase>

    const read = async <A>(
      operation: Parameters<typeof runApi<A, unknown>>[0],
    ) => {
      const result = await runApi(operation)
      if (Exit.isFailure(result)) {
        throw new Error("Test API operation failed")
      }
      return result.value
    }

    beforeAll(async () => {
      vi.stubEnv("DATABASE_URL", process.env.TEST_DATABASE_URL!)
      vi.stubEnv("FLOWMARK_DEMO_MODE", "false")
      connection = createDatabase(process.env.TEST_DATABASE_URL!)
      const { db } = connection
      await db
        .insert(workspaces)
        .values({ id: workspaceId, name: "Bound run fixture" })
      await db
        .insert(projects)
        .values({ id: projectId, workspaceId, name: "Bound run fixture" })
      await db.insert(projectApiKeys).values([
        { projectId, keyHash: hashApiKey(writeKey), permission: "write" },
        { projectId, keyHash: hashApiKey(readKey), permission: "read" },
      ])
      await db.insert(deploymentBindings).values({
        id: bindingId,
        projectId,
        repository: "example/checkout",
        service: "checkout",
        environment: "fixture",
        secretHash: createHash("sha256").update(token).digest("hex"),
      })
      const registered = await deployment(
        new Request("http://localhost/v1/deployments", {
          method: "POST",
          headers: { authorization: "Bearer " + token },
          body: JSON.stringify({
            bindingId,
            deploymentId,
            manifest: {
              version: 1,
              repository: "example/checkout",
              artifactDigest,
              revision: sourceRevision,
              probes: [
                {
                  probeId: "checkout.place",
                  behaviorId: "checkout.place",
                  behaviorRevision: "1",
                  location: {
                    kind: "source",
                    path: "src/checkout.ts",
                    symbol: "checkout",
                  },
                },
              ],
            },
          }),
        }),
      )
      expect(registered.status).toBe(200)
      vi.stubGlobal("fetch", (url: RequestInfo | URL, init?: RequestInit) =>
        ingest(new Request(url, init)),
      )
    })

    afterAll(async () => {
      await connection?.close()
      vi.unstubAllGlobals()
      vi.unstubAllEnvs()
    })

    it("stores the bound run for the probe path and keeps a mismatched digest unknown", async () => {
      const startedAfter = new Date(Date.now() - 60_000).toISOString()
      const bound = createFlowmark({
        apiUrl: "http://localhost",
        apiKey: writeKey,
        environment: "fixture",
        deployment: {
          bindingId,
          deploymentId,
          artifactDigest,
          probeId: "checkout.place",
        },
      })
      await expect(
        bound.workflow("checkout.place", async () => "placed", {
          id: boundRunId,
          properties: { card: "4111" },
        }),
      ).resolves.toBe("placed")
      await bound.shutdown()

      const mismatched = createFlowmark({
        apiUrl: "http://localhost",
        apiKey: writeKey,
        environment: "fixture",
        deployment: {
          bindingId,
          deploymentId,
          artifactDigest: otherDigest,
          probeId: "checkout.place",
        },
      })
      await expect(
        mismatched.workflow("checkout.other", async () => "stored", {
          id: unknownRunId,
        }),
      ).resolves.toBe("stored")
      await mismatched.shutdown()

      const startedBefore = new Date(Date.now() + 60_000).toISOString()
      const change = await read(
        GetProjectWorkflowData.use((queries) =>
          queries.artifactMappings(reader, {
            repository: "example/checkout",
            environment: "fixture",
          }),
        ),
      )
      const ranked = rankChangeMappings(
        { files: ["src/checkout.ts"], symbols: ["checkout"] },
        change.mappings,
      )
      expect(ranked.candidates[0]?.probe.probeId).toBe("checkout.place")
      const selected = await read(
        GetProjectWorkflowData.use((queries) =>
          queries.listRuns(reader, {
            namespace: "application",
            startedAfter,
            startedBefore,
            executionSelector: {
              bindingId,
              deploymentId,
              artifactDigest,
              probeId: "checkout.place",
            },
            limit: 10,
          }),
        ),
      )
      expect(selected.runs.map((run) => run.externalId)).toContain(boundRunId)
      expect(selected.runs.map((run) => run.externalId)).not.toContain(
        unknownRunId,
      )

      const stored = await read(
        GetProjectWorkflowData.use((queries) =>
          queries.listRuns(reader, {
            workflow: "checkout.other",
            limit: 10,
          }),
        ),
      )
      const unknown = stored.runs.find((run) => run.externalId === unknownRunId)
      expect(unknown).toBeDefined()
      const evidence = await read(
        GetProjectWorkflowData.use((queries) =>
          queries.runEventPage(reader, {
            runId: unknown!.id,
            observationsOnly: true,
            limit: 12,
          }),
        ),
      )
      expect(evidence.events[0]?.runtimeObservation).toMatchObject({
        binding: { status: "unknown" },
        observation: { kind: "observation", references: [] },
      })
      expect(JSON.stringify(evidence.events)).not.toContain("4111")
    })
  },
)
