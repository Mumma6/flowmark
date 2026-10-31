import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { test } from "node:test"
import { sql } from "drizzle-orm"
import { Effect } from "effect"
import { createDatabase } from "../../src/client.js"
import { Database } from "../../src/persistence/database.js"
import { appendEvent } from "../../src/persistence/workflows/writes/append-event.js"
import { backfillRunFacts } from "../../src/persistence/workflows/writes/backfill-run-facts.js"
import { getOperationFacts } from "../../src/persistence/workflows/queries/get-operation-facts.js"
import { operationSummaries } from "../../src/persistence/workflows/queries/get-run-comparison.js"
import { getRunTimeline } from "../../src/persistence/workflows/queries/get-run-timeline.js"
import {
  dailyInsightsSql,
  listRunsSql,
  projectMetricsSql,
  workflowSummariesSql,
} from "../../src/persistence/workflows/sql/run-summaries.js"
import {
  operationInsightsSql,
  failureCodeInsightsSql,
  operationAttributionSql,
} from "../../src/persistence/workflows/sql/insights.js"
import { businessInsightsSql } from "../../src/persistence/workflows/sql/business-insights.js"

const url = process.env.TEST_DATABASE_URL
const asOf = "2026-10-31T00:00:00Z"
test(
  "compact facts preserve raw historical populations, ordering, ownership and repair",
  { skip: !url },
  async () => {
    assert.ok(
      ["localhost", "127.0.0.1", "[::1]"].includes(new URL(url!).hostname),
      "disposable loopback TEST_DATABASE_URL required",
    )
    const { db, close } = createDatabase(url!)
    const workspace = randomUUID(),
      project = randomUUID(),
      other = randomUUID(),
      workflow = randomUUID(),
      run = randomUUID(),
      otherRun = randomUUID()
    const execute = <A, E>(effect: Effect.Effect<A, E, typeof db>) =>
      Effect.runPromise(effect.pipe(Effect.provideService(Database, db)))
    try {
      await db.execute(
        sql`INSERT INTO workspaces(id, name) VALUES (${workspace}, 'facts-test')`,
      )
      await db.execute(
        sql`INSERT INTO projects(id,workspace_id,name) VALUES (${project},${workspace},'facts-test'),(${other},${workspace},'other')`,
      )
      await db.execute(
        sql`INSERT INTO workflows(id,project_id,name) VALUES (${workflow},${project},'facts.import')`,
      )
      await db.execute(
        sql`INSERT INTO workflow_runs(id, workflow_id, external_id, started_at, outcome) VALUES (${run},${workflow},'legacy','2026-10-20T00:00:00Z','partial'),(${otherRun},${workflow},'open','2026-10-19T00:00:00Z',null)`,
      )
      const operationId = randomUUID(),
        repeatedId = randomUUID()
      // Historical raw writers deliberately include mixed terminals, repeated closes and equal timestamps.
      for (const [type, second, result, step, op, duration, code] of [
        ["started", 0, null, null, null, null, null],
        ["step", 4, null, "last-step", null, null, null],
        ["step", 2, null, "late-arrival-older-time", null, null, null],
        ["report", 5, { saved: 999 }, null, null, null, null],
        ["operation_completed", 7, null, null, operationId, 10, null],
        ["operation_started", 6, null, null, operationId, null, null],
        ["operation_failed", 8, null, null, operationId, 20, null],
        ["operation_started", 8, null, null, repeatedId, null, null],
        ["completed", 9, { saved: 100, input: 200 }, null, null, null, null],
        ["failed", 10, null, null, null, null, "LEGACY"],
        ["failed", 11, { saved: 50, input: 200 }, null, null, null, "OTHER"],
      ] as const) {
        await db.execute(sql`INSERT INTO workflow_events(event_id,run_id,type,occurred_at,created_at,result,step,operation_id,operation_name,duration_ms,error,properties)
        VALUES (${randomUUID()},${run},${type},'2026-10-20T00:00:00Z'::timestamptz + ${second} * interval '1 second','2026-10-20T00:01:00Z',${result ? JSON.stringify(result) : null}::jsonb,${step},${op},${op ? "push" : null},${duration},${code ? JSON.stringify({ code }) : null}::jsonb,${type === "started" ? '{"definitionRevision":"v1"}' : null}::jsonb)`)
      }
      // The first AFTER ROW receipt sees the entire bulk statement; later receipts must be idempotent.
      await db.execute(
        sql`DELETE FROM workflow_run_facts WHERE run_id = ${run}`,
      )
      await db.execute(sql`INSERT INTO workflow_events(event_id,run_id,type,operation_id,operation_name,duration_ms,occurred_at)
      VALUES (${randomUUID()},${run},'operation_completed',${randomUUID()},'bulk',5,'2026-10-20T00:00:03Z'),
             (${randomUUID()},${run},'operation_completed',${randomUUID()},'bulk',7,'2026-10-20T00:00:03Z')`)
      // Independent raw writers serialize projection changes through the same run lock.
      await Promise.all(
        [3, 4].map((duration) =>
          db.execute(sql`INSERT INTO workflow_events(event_id,run_id,type,operation_id,operation_name,duration_ms,occurred_at)
      VALUES (${randomUUID()},${run},'operation_completed',${randomUUID()},'concurrent',${duration},'2026-10-20T00:00:03Z')`),
        ),
      )
      const window = {
        startedAfter: "2026-10-20T00:00:00Z",
        startedBefore: "2026-10-27T00:00:00Z",
      }
      const previous = {
        startedAfter: "2026-10-13T00:00:00Z",
        startedBefore: "2026-10-20T00:00:00Z",
      }
      const query = {
        workflow: "facts.import",
        revision: "v1",
        path: ["saved"],
        numerator: ["saved"],
        denominator: ["input"],
        currentStartedAfter: window.startedAfter,
        currentStartedBefore: window.startedBefore,
        previousStartedAfter: previous.startedAfter,
        previousStartedBefore: previous.startedBefore,
      }
      const snapshot = async () => {
        const queries = [
          listRunsSql(project, { limit: 50, asOf }),
          projectMetricsSql(project),
          workflowSummariesSql(project),
          dailyInsightsSql(project),
          operationInsightsSql(project),
          failureCodeInsightsSql(project),
          operationAttributionSql(project, undefined, window, previous),
          businessInsightsSql(project, query, {
            path: ["saved"],
            label: "Saved",
            kind: "count",
            aggregate: true,
          }),
        ]
        const result = []
        for (const query of queries)
          result.push(Array.from(await db.execute(query)))
        return result
      }
      const projected = await snapshot()
      assert.equal((await execute(getOperationFacts(other, run))).length, 0)
      assert.deepEqual(
        operationSummaries(await execute(getOperationFacts(project, run))),
        operationSummaries(await execute(getRunTimeline(project, run))),
      )
      await db.execute(
        sql`DELETE FROM workflow_run_facts WHERE run_id = ${run}`,
      )
      const raw = await snapshot()
      assert.deepEqual(projected, raw)
      assert.equal(
        (await execute(backfillRunFacts(other, null, 100, true))).inspected,
        0,
      )
      const dry = await execute(backfillRunFacts(project, null, 100, false))
      assert.equal(dry.rebuilt, 0)
      assert.equal(dry.needsRebuild, 2) // eventless open run is also not yet projected
      const first = await execute(backfillRunFacts(project, null, 1, true))
      const resumed = await execute(
        backfillRunFacts(project, first.after, 1, true),
      )
      assert.equal(first.inspected + resumed.inspected, 2)
      assert.deepEqual(await snapshot(), raw)
      assert.equal(
        (await execute(backfillRunFacts(project, null, 100, false))).fresh,
        2,
      )
      await execute(backfillRunFacts(project, null, 100, true))
      assert.deepEqual(await snapshot(), raw)
      const [fact] = await db.execute(
        sql`SELECT status, result, duration_ms, step, fail_code, definition_revision FROM workflow_run_facts WHERE run_id = ${run}`,
      )
      assert.deepEqual(fact, {
        status: "Failed",
        result: { saved: 50, input: 200 },
        duration_ms: 11000,
        step: "last-step",
        fail_code: "OTHER",
        definition_revision: "v1",
      })
      const metricBefore = await db.execute(
        sql`SELECT count(*)::int AS count FROM workflow_metric_facts WHERE run_id = ${run}`,
      )
      await assert.rejects(
        db.transaction(async (tx) => {
          await tx.execute(
            sql`INSERT INTO workflow_events(event_id,run_id,type,occurred_at) VALUES (${randomUUID()},${run},'failed',now())`,
          )
          throw new Error("interrupted transaction")
        }),
      )
      assert.deepEqual(await snapshot(), raw)
      assert.deepEqual(
        await db.execute(
          sql`SELECT count(*)::int AS count FROM workflow_metric_facts WHERE run_id = ${run}`,
        ),
        metricBefore,
      )
      // Equal event times/receipt times are ordered by event row UUID identically by rebuild and incremental path.
      await db.execute(
        sql`INSERT INTO workflow_events(id,event_id,run_id,type,occurred_at,created_at,step) VALUES ('ffffffff-ffff-ffff-ffff-ffffffffffff',${randomUUID()},${run},'step','2026-10-20T00:00:04Z','2026-10-20T00:01:00Z','tie-winner')`,
      )
      await execute(backfillRunFacts(project, null, 100, true))
      const [tie] = await db.execute(
        sql`SELECT step FROM workflow_run_facts WHERE run_id = ${run}`,
      )
      assert.equal(tie.step, "tie-winner")
      // Removing owned raw evidence removes its metric fact; removing the run removes the summary.
      await db.execute(
        sql`DELETE FROM workflow_events WHERE run_id IN (${run},${otherRun})`,
      )
      assert.equal(
        (
          await db.execute(
            sql`SELECT * FROM workflow_metric_facts WHERE run_id = ${run}`,
          )
        ).length,
        0,
      )
      await db.execute(
        sql`DELETE FROM workflow_runs WHERE id IN (${run},${otherRun})`,
      )
      assert.equal(
        (
          await db.execute(
            sql`SELECT * FROM workflow_run_facts WHERE run_id = ${run}`,
          )
        ).length,
        0,
      )
    } finally {
      await db.execute(
        sql`DELETE FROM workflow_events WHERE run_id IN (SELECT r.id FROM workflow_runs r JOIN workflows w ON w.id=r.workflow_id WHERE w.project_id IN (${project},${other}))`,
      )
      await db.execute(
        sql`DELETE FROM workflow_runs WHERE workflow_id IN (SELECT id FROM workflows WHERE project_id IN (${project},${other}))`,
      )
      await db.execute(
        sql`DELETE FROM workflows WHERE project_id IN (${project},${other})`,
      )
      await db.execute(
        sql`DELETE FROM projects WHERE id IN (${project},${other})`,
      )
      await db.execute(sql`DELETE FROM workspaces WHERE id=${workspace}`)
      await close()
    }
  },
)

test(
  "only accepted inserts change facts, including continuation and late terminal decisions",
  { skip: !url },
  async () => {
    const { db, close } = createDatabase(url!)
    const workspace = randomUUID(),
      project = randomUUID(),
      external = randomUUID()
    const execute = <A, E>(effect: Effect.Effect<A, E, typeof db>) =>
      Effect.runPromise(effect.pipe(Effect.provideService(Database, db)))
    try {
      await db.execute(
        sql`INSERT INTO workspaces(id,name) VALUES (${workspace},'accepted-facts')`,
      )
      await db.execute(
        sql`INSERT INTO projects(id,workspace_id,name) VALUES (${project},${workspace},'accepted-facts')`,
      )
      const base = {
        workflow: "accepted.facts",
        runId: external,
        timestamp: "2026-10-21T00:00:00Z",
      }
      const eventId = randomUUID()
      assert.equal(
        await execute(
          appendEvent(project, eventId, {
            ...base,
            type: "started",
            properties: { definitionRevision: "v1" },
          }),
        ),
        "recorded",
      )
      const read = () =>
        db.execute(
          sql`SELECT f.* FROM workflow_run_facts f JOIN workflow_runs r ON r.id=f.run_id JOIN workflows w ON w.id=r.workflow_id WHERE w.project_id=${project}`,
        )
      const started = Array.from(await read())
      assert.equal(
        await execute(
          appendEvent(project, eventId, { ...base, type: "started" }),
        ),
        "duplicate",
      )
      assert.deepEqual(Array.from(await read()), started)
      assert.equal(
        await execute(
          appendEvent(project, randomUUID(), {
            ...base,
            type: "step",
            step: "continued",
          }),
        ),
        "recorded",
      )
      assert.equal(
        await execute(
          appendEvent(project, randomUUID(), {
            ...base,
            type: "report",
            result: { saved: 999 },
          }),
        ),
        "recorded",
      )
      assert.equal(
        await execute(
          appendEvent(project, randomUUID(), {
            ...base,
            type: "completed",
            result: { saved: 2 },
          }),
        ),
        "recorded",
      )
      const completed = Array.from(await read())
      assert.equal(completed[0].status, "Completed")
      assert.deepEqual(completed[0].result, { saved: 2 })
      assert.equal(
        await execute(
          appendEvent(project, randomUUID(), {
            ...base,
            type: "failed",
            reason: "late",
          }),
        ),
        "conflict",
      )
      assert.equal(
        await execute(
          appendEvent(project, randomUUID(), {
            ...base,
            type: "step",
            step: "ignored",
          }),
        ),
        "ignored",
      )
      assert.deepEqual(Array.from(await read()), completed)
    } finally {
      await db.execute(
        sql`DELETE FROM workflow_events WHERE run_id IN (SELECT r.id FROM workflow_runs r JOIN workflows w ON w.id=r.workflow_id WHERE w.project_id=${project})`,
      )
      await db.execute(
        sql`DELETE FROM workflow_runs WHERE workflow_id IN (SELECT id FROM workflows WHERE project_id=${project})`,
      )
      await db.execute(sql`DELETE FROM workflows WHERE project_id=${project}`)
      await db.execute(sql`DELETE FROM projects WHERE id=${project}`)
      await db.execute(sql`DELETE FROM workspaces WHERE id=${workspace}`)
      await close()
    }
  },
)
