import { createHash, randomBytes, randomUUID } from "node:crypto"
import { eq } from "drizzle-orm"
import { Exit } from "effect"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import {
  classifyObservedCase,
  GetProjectWorkflowData,
  revisionClassNote,
  runApi,
} from "@flowmark/api"
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
  "revision classes from stored receipts",
  () => {
    const projectId = randomUUID()
    const workspaceId = randomUUID()
    const bindingId = randomUUID()
    const readKey = randomUUID()
    const token = "fmd_" + randomBytes(32).toString("hex")
    const olderId = "older-" + randomUUID()
    const latestId = "latest-" + randomUUID()
    const olderDigest = "sha256:" + "a".repeat(64)
    const latestDigest = "sha256:" + "b".repeat(64)
    const reader = { _tag: "Key" as const, header: `Bearer ${readKey}` }
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

    const manifest = (
      artifactDigest: string,
      revision: string,
      probes: readonly unknown[],
    ) => ({
      version: 1,
      repository: "example/checkout",
      artifactDigest,
      revision,
      probes,
    })

    beforeAll(async () => {
      vi.stubEnv("DATABASE_URL", process.env.TEST_DATABASE_URL!)
      vi.stubEnv("FLOWMARK_DEMO_MODE", "false")
      connection = createDatabase(process.env.TEST_DATABASE_URL!)
      const { db } = connection
      await db
        .insert(workspaces)
        .values({ id: workspaceId, name: "Revision class fixture" })
      await db
        .insert(projects)
        .values({ id: projectId, workspaceId, name: "Revision class fixture" })
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
      const sourceProbe = {
        probeId: "checkout.place",
        behaviorId: "checkout.place",
        behaviorRevision: "1",
        location: {
          kind: "source",
          path: "src/checkout.ts",
          symbol: "checkout",
        },
      }
      const post = async (
        deploymentId: string,
        artifactDigest: string,
        revision: string,
        probes: readonly unknown[],
      ) => {
        const response = await deployment(
          new Request("http://localhost/v1/deployments", {
            method: "POST",
            headers: { authorization: "Bearer " + token },
            body: JSON.stringify({
              bindingId,
              deploymentId,
              manifest: manifest(artifactDigest, revision, probes),
            }),
          }),
        )
        expect(response.status).toBe(200)
      }
      await post(olderId, olderDigest, "a".repeat(40), [sourceProbe])
      await post(latestId, latestDigest, "b".repeat(40), [
        sourceProbe,
        {
          probeId: "checkout.review",
          behaviorId: "checkout.review",
          behaviorRevision: "1",
          location: {
            kind: "ambiguous",
            candidates: [
              { path: "src/review.ts", symbol: "review" },
              { path: "src/other.ts", symbol: "other" },
            ],
          },
        },
      ])
      await db
        .update(deploymentReceipts)
        .set({ receivedAt: new Date("2026-11-01T00:00:00.000Z") })
        .where(eq(deploymentReceipts.deploymentId, olderId))
      await db
        .update(deploymentReceipts)
        .set({ receivedAt: new Date("2026-11-02T00:00:00.000Z") })
        .where(eq(deploymentReceipts.deploymentId, latestId))
    })

    afterAll(async () => {
      await connection?.close()
      vi.unstubAllEnvs()
    })

    it("reads two receipts, a diff, a lexical ticket and an ambiguous probe", async () => {
      const loaded = await read(
        GetProjectWorkflowData.use((queries) =>
          queries.artifactMappings(reader, {
            repository: "example/checkout",
            environment: "fixture",
          }),
        ),
      )
      const older = loaded.mappings.find(
        (item) => item.deploymentId === olderId,
      )
      const latest = loaded.mappings.find(
        (item) => item.deploymentId === latestId,
      )
      expect(older).toBeDefined()
      expect(latest).toBeDefined()
      const source = older!.manifest.probes.find(
        (probe) => probe.probeId === "checkout.place",
      )
      const currentSource = latest!.manifest.probes.find(
        (probe) => probe.probeId === "checkout.place",
      )
      const ambiguous = latest!.manifest.probes.find(
        (probe) => probe.probeId === "checkout.review",
      )
      expect(source).toBeDefined()
      expect(currentSource).toBeDefined()
      expect(ambiguous).toBeDefined()
      const diff = "+++ b/src/checkout.ts"
      const historical = classifyObservedCase({
        deployment: older!,
        probe: source!,
        mappings: loaded.mappings,
        diff,
        matchReason: "file",
        otherRevision: false,
      })
      const current = classifyObservedCase({
        deployment: latest!,
        probe: currentSource!,
        mappings: loaded.mappings,
        diff,
        matchReason: "file",
        otherRevision: false,
      })
      const lexical = classifyObservedCase({
        deployment: latest!,
        probe: currentSource!,
        mappings: loaded.mappings,
        matchReason: "lexical",
        otherRevision: false,
      })
      const uncertain = classifyObservedCase({
        deployment: latest!,
        probe: ambiguous!,
        mappings: loaded.mappings,
        diff: "+++ b/src/review.ts",
        matchReason: "file",
        strength: "ambiguous",
        otherRevision: false,
      })
      expect(historical.revisionClasses).toEqual([
        "historical",
        "diff-affected",
      ])
      expect(current.revisionClasses).toEqual([
        "reported-current",
        "diff-affected",
      ])
      expect(lexical.revisionClasses).toContain("mapping-uncertain")
      expect(lexical.revisionClasses).not.toContain("diff-affected")
      expect(lexical.behaviorClaim).toBeNull()
      expect(uncertain.behaviorClaim).toBeNull()
      const text = JSON.stringify({
        note: revisionClassNote(loaded.truncated),
        historical,
        current,
        lexical,
        uncertain,
        ticket: "checkout place words only",
      })
      expect(text).toContain("not a serving interval")
      expect(text).not.toContain("was serving")
    })
  },
)
