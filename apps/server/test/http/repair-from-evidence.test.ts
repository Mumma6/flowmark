import { createHash, randomBytes, randomUUID } from "node:crypto"
import { Exit } from "effect"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { Key, proposeObservationRepair, runApi } from "@flowmark/api"
import confirmation from "../../../../examples/questions/later-confirmation.json"
import {
  createDatabase,
  deploymentBindings,
  projectApiKeys,
  projects,
  workspaces,
} from "@flowmark/db"
import { hashApiKey } from "@flowmark/db/persistence"
import {
  createFlowmark,
  createRuntimeObservationEmitter,
} from "../../../../packages/sdk/src/index.js"
import { POST as deployment } from "../../app/v1/deployments/route"
import { POST as ingest } from "../../app/v1/events/route"

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  "repair proposal from a stored confirmation gap",
  () => {
    const projectId = randomUUID()
    const workspaceId = randomUUID()
    const bindingId = randomUUID()
    const writeKey = randomUUID()
    const readKey = randomUUID()
    const referenceKey = randomUUID()
    const token = "fmd_" + randomBytes(32).toString("hex")
    const deploymentId = "repair-" + randomUUID()
    const artifactDigest = "sha256:" + "e".repeat(64)
    const reader = Key({ header: `Bearer ${readKey}` })
    let connection: ReturnType<typeof createDatabase>

    beforeAll(async () => {
      vi.stubEnv("DATABASE_URL", process.env.TEST_DATABASE_URL!)
      vi.stubEnv("FLOWMARK_DEMO_MODE", "false")
      connection = createDatabase(process.env.TEST_DATABASE_URL!)
      const { db } = connection
      await db
        .insert(workspaces)
        .values({ id: workspaceId, name: "Repair fixture" })
      await db
        .insert(projects)
        .values({ id: projectId, workspaceId, name: "Repair fixture" })
      await db.insert(projectApiKeys).values([
        { projectId, keyHash: hashApiKey(writeKey), permission: "write" },
        { projectId, keyHash: hashApiKey(readKey), permission: "read" },
      ])
      await db.insert(deploymentBindings).values({
        id: bindingId,
        projectId,
        repository: confirmation.scope.repository,
        service: confirmation.scope.service,
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
              repository: confirmation.scope.repository,
              artifactDigest,
              revision: "a".repeat(40),
              probes: [
                {
                  probeId: confirmation.attemptProbe,
                  behaviorId: confirmation.behaviorId,
                  behaviorRevision: confirmation.behaviorRevision,
                  location: {
                    kind: "source",
                    path: "src/attempt.ts",
                    symbol: "attempt",
                  },
                },
                {
                  probeId: confirmation.confirmationProbe,
                  behaviorId: confirmation.behaviorId,
                  behaviorRevision: confirmation.behaviorRevision,
                  location: {
                    kind: "source",
                    path: "src/confirm.ts",
                    symbol: "confirm",
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
      const client = createFlowmark({
        apiUrl: "http://localhost",
        apiKey: writeKey,
        environment: "fixture",
      })
      const flow = client.workflow(confirmation.scope.workflow)
      const emitter = (probeId: string) =>
        createRuntimeObservationEmitter({
          key: referenceKey,
          namespaces: [{ kind: "change", namespace: "payment.request" }],
          probe: {
            bindingId,
            deploymentId,
            artifactDigest,
            probeId,
          },
        })
      emitter(confirmation.attemptProbe).observe(flow, {
        change: { "payment.request": randomUUID() },
      })
      emitter(confirmation.confirmationProbe).observe(flow, {})
      flow.done()
      await client.shutdown()
    })

    afterAll(async () => {
      await connection?.close()
      vi.unstubAllGlobals()
      vi.unstubAllEnvs()
    })

    it("reads the stored missing link and proposes the confirmation site", async () => {
      const result = await runApi(
        proposeObservationRepair(reader, {
          question: confirmation,
          repository: confirmation.scope.repository,
          branch: "feature/confirm-link",
          access: "authorized",
          traffic: "fixture-ready",
          approvedNamespaces: ["payment.request"],
          reportingSites: ["src/confirm.ts"],
          maxOverheadMs: 10,
          attempt: 1,
          startedAfter: new Date(Date.now() - 60_000).toISOString(),
          startedBefore: new Date(Date.now() + 60_000).toISOString(),
          environment: "fixture",
        }),
      )
      expect(Exit.isSuccess(result)).toBe(true)
      if (Exit.isSuccess(result)) {
        expect(result.value).toMatchObject({
          remedy: "add-permitted-reference",
          branch: "feature/confirm-link",
          merged: false,
        })
        expect(result.value.files.map((file) => file.path)).toEqual([
          "src/confirm.ts",
          "test/flowmark-payments.confirmation-for-attempt.test.ts",
        ])
      }
    })
  },
)
