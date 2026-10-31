import { randomUUID } from "node:crypto"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import {
  createDatabase,
  workspaces,
  projects,
  projectApiKeys,
  workflowSearchFields,
} from "@flowmark/db"
import { hashApiKey } from "@flowmark/db/persistence"
import { POST } from "../../app/v1/events/route"
import { appRouter } from "../../src/adapters/trpc"

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  "comparable peer cohorts",
  () => {
    const projectId = randomUUID(),
      workspaceId = randomUUID(),
      key = randomUUID(),
      otherKey = randomUUID(),
      otherProject = randomUUID()
    let connection: ReturnType<typeof createDatabase>
    const readKey = randomUUID()
    const ids: string[] = []
    const caller = (credential = readKey) =>
      appRouter.createCaller({
        request: new Request("http://localhost/api/trpc", {
          headers: { authorization: `Bearer ${credential}` },
        }),
      })
    beforeAll(async () => {
      vi.stubEnv("DATABASE_URL", process.env.TEST_DATABASE_URL!)
      vi.stubEnv("FLOWMARK_DEMO_MODE", "false")
      connection = createDatabase(process.env.TEST_DATABASE_URL!)
      await connection.db
        .insert(workspaces)
        .values({ id: workspaceId, name: "Peer tests" })
      await connection.db.insert(projects).values([
        { id: projectId, workspaceId, name: "Peers" },
        { id: otherProject, workspaceId, name: "Other peers" },
      ])
      await connection.db.insert(projectApiKeys).values([
        { projectId, keyHash: hashApiKey(key), permission: "write" },
        { projectId, keyHash: hashApiKey(readKey), permission: "read" },
        {
          projectId: otherProject,
          keyHash: hashApiKey(otherKey),
          permission: "read",
        },
      ])
      await connection.db.insert(workflowSearchFields).values({
        projectId,
        workflow: "peer.import",
        fields: [{ key: "provider", role: "dimension", values: ["a", "b"] }],
      })
      for (let index = 0; index < 56; index++) {
        const runId = randomUUID()
        ids.push(runId)
        const timestamp =
          index === 55
            ? "2026-10-30T00:00:00.000Z"
            : `2026-10-${index === 54 ? "29" : "20"}T00:00:00.000Z`
        for (const type of ["started", "completed"]) {
          const response = await POST(
            new Request("http://localhost/v1/events", {
              method: "POST",
              headers: { authorization: `Bearer ${key}` },
              body: JSON.stringify({
                eventId: randomUUID(),
                event: {
                  type,
                  workflow: "peer.import",
                  runId,
                  timestamp,
                  ...(type === "started"
                    ? {
                        ...(index === 53
                          ? {}
                          : {
                              environment:
                                index === 54 ? "staging" : "production",
                            }),
                        release: index % 2 ? "v2" : "v1",
                        properties: { provider: index % 2 ? "b" : "a" },
                      }
                    : {}),
                },
              }),
            }),
          )
          expect(response.status).toBe(202)
          if (type === "started") {
            const operationIds = Array.from(
              { length: index === 55 ? 3 : 1 },
              () => randomUUID(),
            )
            for (const [position, operationId] of operationIds.entries()) {
              for (const operationType of position === 2
                ? ["operation_started"]
                : [
                    "operation_started",
                    position === 1 ? "operation_failed" : "operation_completed",
                  ]) {
                const durationMs = index === 55 ? (position + 1) * 10 : 30
                const response = await POST(
                  new Request("http://localhost/v1/events", {
                    method: "POST",
                    headers: { authorization: `Bearer ${key}` },
                    body: JSON.stringify({
                      eventId: randomUUID(),
                      event: {
                        type: operationType,
                        workflow: "peer.import",
                        runId,
                        timestamp,
                        operationId,
                        operationName: "batch",
                        ...(operationType === "operation_started"
                          ? {}
                          : { durationMs }),
                        ...(operationType === "operation_failed"
                          ? { failure: { code: "BATCH_FAILED" } }
                          : {}),
                      },
                    }),
                  }),
                )
                expect(response.status).toBe(202)
              }
            }
          }
        }
      }
    }, 60_000)
    afterAll(async () => {
      await connection?.close()
      vi.unstubAllEnvs()
    })
    it("caps earlier same-environment peers and exposes the uncapped eligible population", async () => {
      const current = await caller().run.list({
        workflow: "peer.import",
        externalId: ids[55],
      })
      const id = current.runs[0].id
      const result = await caller().run.compare({ id })
      expect(
        result.operations.find((row) => row.name === "batch"),
      ).toMatchObject({
        currentOccurrenceCount: 3,
        currentOpenCount: 1,
        currentFailedCount: 1,
        currentMedianOccurrenceDurationMs: 15,
        currentTotalRecordedDurationMs: 30,
        peerMedianOccurrenceDurationMs: 30,
        peerMedianTotalRecordedDurationMs: 30,
        peerPresentCount: 50,
      })
      expect(result.population).toMatchObject({
        eligible: 53,
        selected: 50,
        days: 30,
        environment: "production",
      })
      expect(
        result.peers.every(
          (peer) =>
            Date.parse(peer.startedAt) < Date.parse(current.runs[0].startedAt),
        ),
      ).toBe(true)
      expect(
        (await caller().run.compare({ id, selection: { environment: "all" } }))
          .population?.eligible,
      ).toBe(55)
      expect(
        (await caller().run.compare({ id, selection: { sameRelease: true } }))
          .population?.eligible,
      ).toBe(26)
      expect(
        (
          await caller().run.compare({
            id,
            selection: { dimensionKey: "provider", dimensionValue: "a" },
          })
        ).population?.eligible,
      ).toBe(27)
      expect(
        (await caller().run.compare({ id, selection: { days: 1 } })).peers,
      ).toEqual([])
      const missing = (
        await caller().run.list({
          workflow: "peer.import",
          externalId: ids[53],
        })
      ).runs[0]
      const missingPeers = await caller().run.compare({ id: missing.id })
      expect(missingPeers.population).toMatchObject({
        environment: null,
        eligible: 0,
        selected: 0,
      })
      const tied = (
        await caller().run.list({ workflow: "peer.import", externalId: ids[0] })
      ).runs[0]
      const tiedPeers = await caller().run.compare({ id: tied.id })
      expect(
        tiedPeers.peers.every(
          (peer) =>
            Date.parse(peer.startedAt) < Date.parse(tied.startedAt) ||
            (Date.parse(peer.startedAt) === Date.parse(tied.startedAt) &&
              peer.id < tied.id),
        ),
      ).toBe(true)
      await expect(
        caller().run.compare({
          id,
          selection: { dimensionKey: "undeclared", dimensionValue: "a" },
        }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" })
      expect((await caller(otherKey).run.compare({ id })).current).toBeNull()
    })
  },
)
