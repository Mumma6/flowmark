import { randomUUID } from "node:crypto"
import { and, count, eq, sql } from "drizzle-orm"
import { Array, Effect, Order, Ref } from "effect"
import {
  createDatabase,
  projectApiKeys,
  user,
  workflowEvents,
  workflowRuns,
  workflows,
} from "@flowmark/db"
import {
  Database,
  createOwnedProject,
  hashApiKey,
} from "@flowmark/db/persistence"
import { expect, it, vi } from "vitest"
import { POST } from "../../app/v1/events/route"
import { appRouter } from "../../src/adapters/trpc/router"

const burstSize = 8
const bursts = 8
const waitSampleMs = 5
const workflow = "capture-probe.import"

it.skipIf(!process.env.TEST_DATABASE_URL)(
  "measures semantic receipts and sampled lock waits with and without a separate technical burst",
  async () => {
    const connection = createDatabase(process.env.TEST_DATABASE_URL!)
    const applicationName = `capture-probe-${randomUUID()}`
    const apiDatabase = new URL(process.env.TEST_DATABASE_URL!)
    apiDatabase.searchParams.set("application_name", applicationName)
    vi.stubEnv("DATABASE_URL", apiDatabase.href)
    const program = Effect.gen(function* () {
      const userId = randomUUID()
      yield* Effect.promise(() =>
        connection.db.insert(user).values({
          id: userId,
          name: "Capture benchmark",
          email: `${userId}@example.test`,
        }),
      )
      const fixture = yield* createOwnedProject(userId, {
        workspace: "Capture benchmark",
        project: "Ingestion receipts",
      }).pipe(Effect.provideService(Database, connection.db))
      const readKey = `fm_read_${randomUUID()}`
      yield* Effect.promise(() =>
        connection.db.insert(projectApiKeys).values({
          projectId: fixture.projectId,
          permission: "read",
          name: "Capture benchmark",
          keyHash: hashApiKey(readKey),
          keyPrefix: readKey.slice(0, 16),
        }),
      )
      const post = (event: object) =>
        Effect.promise(async () => {
          const before = performance.now()
          const response = await POST(
            new Request("http://localhost/v1/events", {
              method: "POST",
              headers: { authorization: `Bearer ${fixture.writeKey.secret}` },
              body: JSON.stringify({ eventId: randomUUID(), event }),
            }),
          )
          expect(response.status).toBe(202)
          await response.arrayBuffer()
          return performance.now() - before
        })
      const api = appRouter.createCaller({
        request: new Request("http://localhost/api/trpc", {
          headers: { authorization: `Bearer ${readKey}` },
        }),
      })
      const results = yield* Effect.forEach(
        [
          { history: 8, mixed: false },
          { history: 8, mixed: true },
          { history: 96, mixed: false },
          { history: 96, mixed: true },
        ],
        ({ history, mixed }) =>
          Effect.scoped(
            Effect.gen(function* () {
              const runId = randomUUID()
              const base = {
                workflow,
                runId,
                timestamp: new Date().toISOString(),
              }
              const step = (index: number) =>
                post({ ...base, type: "step", step: `item-${index}` })
              yield* post({ ...base, type: "started" })
              yield* Effect.forEach(
                Array.makeBy(history, (index) => index),
                step,
                { discard: true },
              )
              const samples = yield* Ref.make<
                readonly { waiting: number; sessions: number }[]
              >([])
              const sample = Effect.promise(() =>
                connection.db.execute<{
                  waiting: number
                  sessions: number
                }>(sql`
              SELECT count(*) FILTER (WHERE wait_event_type = 'Lock')::int AS waiting,
                     count(*)::int AS sessions
              FROM pg_stat_activity
              WHERE application_name = ${applicationName}
            `),
              ).pipe(
                Effect.flatMap(([result]) =>
                  Ref.update(samples, (previous) => [...previous, result!]),
                ),
                Effect.andThen(Effect.sleep(`${waitSampleMs} millis`)),
              )
              yield* Effect.forkScoped(Effect.forever(sample))
              const technicalJson = JSON.stringify({
                runId,
                records: [
                  { dependency: "primary", status: 429 },
                  { dependency: "fallback", status: 200 },
                ],
              })
              const receiveTechnical = Effect.sync(() => {
                // Separate in-memory decode only. This makes no claim about technical SQL admission.
                const decoded = JSON.parse(technicalJson)
                expect(decoded.records).toHaveLength(2)
              })
              const latencies = yield* Effect.forEach(
                Array.makeBy(bursts, (index) => index),
                (burst) => {
                  const semantic = Effect.forEach(
                    Array.makeBy(
                      burstSize,
                      (index) => history + burst * burstSize + index,
                    ),
                    step,
                    { concurrency: burstSize },
                  )
                  return mixed
                    ? Effect.all(
                        [
                          semantic,
                          Effect.forEach(
                            Array.makeBy(burstSize, () => receiveTechnical),
                            (receive) => receive,
                            { discard: true },
                          ),
                        ],
                        { concurrency: 2 },
                      ).pipe(Effect.map(([times]) => times))
                    : semantic
                },
              ).pipe(Effect.map(Array.flatten))
              const waits = yield* Ref.get(samples)
              yield* post({
                ...base,
                type: "completed",
                result: { imported: 2 },
              })
              const page = yield* Effect.promise(() =>
                api.run.list({ workflow, externalId: runId }),
              )
              expect(page.runs).toMatchObject([
                { status: "Completed", result: { imported: 2 } },
              ])
              const [stored] = yield* Effect.promise(() =>
                connection.db
                  .select({ events: count() })
                  .from(workflowEvents)
                  .innerJoin(
                    workflowRuns,
                    eq(workflowEvents.runId, workflowRuns.id),
                  )
                  .innerJoin(
                    workflows,
                    eq(workflowRuns.workflowId, workflows.id),
                  )
                  .where(
                    and(
                      eq(workflows.projectId, fixture.projectId),
                      eq(workflowRuns.externalId, runId),
                    ),
                  ),
              )
              expect(stored?.events).toBe(history + burstSize * bursts + 2)
              expect(waits.some(({ sessions }) => sessions > 0)).toBe(true)
              const sorted = Array.sort(latencies, Order.Number)
              const receipt = (p: number) =>
                Number(sorted[Math.ceil(sorted.length * p) - 1]!.toFixed(2))
              return {
                initialSteps: history,
                mixed,
                waitSamples: waits.length,
                samplesWithLockWait: waits.filter(({ waiting }) => waiting > 0)
                  .length,
                maxConnectionsWaiting: Math.max(
                  ...waits.map(({ waiting }) => waiting),
                ),
                receiptP95Ms: receipt(0.95),
                receiptP99Ms: receipt(0.99),
                persistedEvents: stored?.events,
              }
            }),
          ),
      )
      console.log(
        "CAPTURE INGESTION BENCHMARK",
        JSON.stringify({
          bursts,
          burstSize,
          waitSampleSleepMs: waitSampleMs,
          results,
          scope:
            "In-process HTTP handler to managed PostgreSQL receipt. Lock occupancy samples across the tagged pool, not per-transaction wait duration. Mixed technical input is decoded in memory.",
        }),
      )
    })
    try {
      await Effect.runPromise(program)
    } finally {
      await connection.close()
      vi.unstubAllEnvs()
    }
  },
  60_000,
)
