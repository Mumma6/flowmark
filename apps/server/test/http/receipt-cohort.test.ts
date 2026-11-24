import { createHash, randomBytes, randomUUID } from "node:crypto"
import { eq } from "drizzle-orm"
import { Exit } from "effect"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { GetProjectWorkflowData, Key, runApi } from "@flowmark/api"
import {
  createDatabase,
  deploymentBindings,
  deploymentReceipts,
  projectApiKeys,
  projects,
  workspaces,
} from "@flowmark/db"
import { hashApiKey } from "@flowmark/db/persistence"
import { POST as deployment } from "../../app/v1/deployments/route"

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  "comparison cohorts from stored receipts",
  () => {
    const projectId = randomUUID()
    const workspaceId = randomUUID()
    const bindingId = randomUUID()
    const readKey = randomUUID()
    const token = "fmd_" + randomBytes(32).toString("hex")
    const reader = Key({ header: `Bearer ${readKey}` })
    const ids = Array.from({ length: 13 }, (_, index) => `cohort-${index}`)
    let connection: ReturnType<typeof createDatabase>

    beforeAll(async () => {
      vi.stubEnv("DATABASE_URL", process.env.TEST_DATABASE_URL!)
      vi.stubEnv("FLOWMARK_DEMO_MODE", "false")
      connection = createDatabase(process.env.TEST_DATABASE_URL!)
      const { db } = connection
      await db
        .insert(workspaces)
        .values({ id: workspaceId, name: "Cohort fixture" })
      await db
        .insert(projects)
        .values({ id: projectId, workspaceId, name: "Cohort fixture" })
      await db.insert(projectApiKeys).values({
        projectId,
        keyHash: hashApiKey(readKey),
        permission: "read",
      })
      await db.insert(deploymentBindings).values({
        id: bindingId,
        projectId,
        repository: "example/checkout",
        service: "checkout",
        environment: "fixture",
        secretHash: createHash("sha256").update(token).digest("hex"),
      })
      for (const [index, deploymentId] of ids.entries()) {
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
                artifactDigest:
                  "sha256:" + index.toString(16).padStart(64, "0"),
                revision: "a".repeat(40),
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
        await db
          .update(deploymentReceipts)
          .set({ receivedAt: new Date(Date.UTC(2026, 0, index + 1)) })
          .where(eq(deploymentReceipts.deploymentId, deploymentId))
      }
    })

    afterAll(async () => {
      await connection?.close()
      vi.unstubAllEnvs()
    })

    it("withholds the rate when the receipt scan is truncated", async () => {
      const result = await runApi(
        GetProjectWorkflowData.use((queries) =>
          queries.compareBehavior(reader, {
            bindingId,
            behaviorId: "checkout.place",
            workflow: "checkout.place",
            before: {
              deploymentId: ids[0] ?? "",
              startedAfter: "2026-01-01T00:00:00.000Z",
              startedBefore: "2026-01-02T00:00:00.000Z",
              samplingPolicy: "all-v1",
            },
            after: {
              deploymentId: ids[12] ?? "",
              startedAfter: "2026-01-13T00:00:00.000Z",
              startedBefore: "2026-01-14T00:00:00.000Z",
              samplingPolicy: "all-v1",
            },
            fallbackStep: "fallback.used",
            normalStep: "primary.used",
            partialOutcome: "partial",
          }),
        ),
      )
      expect(Exit.isSuccess(result)).toBe(true)
      if (!Exit.isSuccess(result) || result.value.status === "unsupported") {
        throw new Error("Comparison did not read the stored receipts")
      }
      expect(result.value.before.receiptCohort.receiptClass).toBe("unknown")
      expect(result.value.after.receiptCohort.classMayBeIncomplete).toBe(true)
      expect(result.value.before.rate).toBeNull()
      expect(result.value.after.rate).toBeNull()
      expect(result.value.limitations).toContain("receipt-scan-truncated")
      expect(JSON.stringify(result.value)).not.toContain("was serving")
      expect(JSON.stringify(result.value)).toContain(
        "not an interval during which that code served",
      )
    })
  },
)
