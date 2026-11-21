import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { test } from "node:test"
import { PROCESS_HEALTH_LIMITS as bounds } from "@flowmarkdev/core"
import { eq, sql } from "drizzle-orm"
import { Effect, Option, Result } from "effect"
import { createDatabase } from "../../src/client.js"
import { Database } from "../../src/persistence/database.js"
import { ExpectationObservationClock } from "../../src/persistence/workflows/observation-clock.js"
import { ProcessHealthBudgetExceeded } from "../../src/persistence/workflows/queries/get-process-health.js"
import { processHealthSql } from "../../src/persistence/workflows/sql/process-health.js"
import { WorkflowStore } from "../../src/persistence/workflows/workflow-store.js"
import { workflowRunFacts } from "../../src/schema/index.js"

const url = process.env.TEST_DATABASE_URL
const start = "2026-10-31T11:00:00.000Z"
const end = "2026-10-31T12:00:00.000Z"
const query = {
  workflow: "bookings",
  expectationName: "confirmed",
  window: { startedAfter: start, startedBefore: end },
}

type ExplainNode = {
  readonly "Subplan Name"?: string
  readonly "Actual Rows": number
  readonly "Index Name"?: string
  readonly Plans?: readonly ExplainNode[]
}

const planNodes = (node: ExplainNode): readonly ExplainNode[] => [
  node,
  ...(node.Plans ?? []).flatMap(planNodes),
]

test(
  "process health reconciles fact/raw records and bounds indexed work under skew",
  { skip: !url },
  async () => {
    const { db, close } = createDatabase(url!)
    const workspaceId = randomUUID()
    const projectId = randomUUID()
    const foreignProjectId = randomUUID()
    const foreignWorkflowId = randomUUID()
    const runCapId = randomUUID()
    const eventCapId = randomUUID()
    const projectionCapId = randomUUID()
    const rawHeavyRun = randomUUID()
    const projectionHeavyRun = randomUUID()
    const observedAt = "2026-10-31T12:01:00.000Z"
    try {
      await db.execute(
        sql`INSERT INTO workspaces(id, name) VALUES (${workspaceId}, 'Process health')`,
      )
      await db.execute(sql`
      INSERT INTO projects(id, workspace_id, name) VALUES
        (${projectId}, ${workspaceId}, 'Process health'),
        (${foreignProjectId}, ${workspaceId}, 'Foreign process health')
    `)
      const store = await Effect.runPromise(
        WorkflowStore.make.pipe(Effect.provideService(Database, db)),
      )
      const reading = (workflow: string) =>
        store.processHealth(projectId, { ...query, workflow }).pipe(
          Effect.provideService(ExpectationObservationClock, {
            now: () => Effect.succeed(new Date(observedAt)),
          }),
        )
      const event = {
        workflow: query.workflow,
        runId: "mixed-facts",
        timestamp: start,
      }
      for (const runId of ["mixed-facts", "keep-fact"]) {
        await Effect.runPromise(
          store.append(projectId, randomUUID(), {
            ...event,
            runId,
            type: "started",
            properties: { definitionRevision: "v1" },
          }),
        )
        await Effect.runPromise(
          store.append(projectId, randomUUID(), {
            ...event,
            runId,
            type: "completed",
            outcome: "submitted",
          }),
        )
      }
      const fixtureRuns = await db.execute<{
        mixed: string
        workflow: string
      }>(sql`
      SELECT r.id AS mixed, w.id AS workflow
      FROM workflow_runs r JOIN workflows w ON w.id = r.workflow_id
      WHERE w.project_id = ${projectId} AND r.external_id = 'mixed-facts'
    `)
      const fixture = fixtureRuns[0]!
      const before = await Effect.runPromise(reading(query.workflow))
      await db
        .delete(workflowRunFacts)
        .where(eq(workflowRunFacts.runId, fixture.mixed))
      const insertionTimestamp = "2026-10-31T11:05:00.000Z"
      await db.execute(sql`
      INSERT INTO workflows (id, project_id, name) VALUES
        (${foreignWorkflowId}, ${foreignProjectId}, ${query.workflow}),
        (${runCapId}, ${projectId}, 'run-cap'),
        (${eventCapId}, ${projectId}, 'event-cap'),
        (${projectionCapId}, ${projectId}, 'projection-cap')
    `)
      await db.execute(sql`
      INSERT INTO workflow_runs (workflow_id, external_id, started_at)
      SELECT w.id, 'skew-' || i, w.started_at
      FROM (VALUES
        (${foreignWorkflowId}::uuid, ${insertionTimestamp}::timestamptz),
        (${fixture.workflow}::uuid, ${end}::timestamptz),
        (${runCapId}::uuid, ${insertionTimestamp}::timestamptz)
      ) AS w(id, started_at)
      CROSS JOIN generate_series(1, ${bounds.runs + 1}::int) g(i)
    `)
      await db.execute(sql`
      INSERT INTO workflow_runs (id, workflow_id, external_id, started_at) VALUES
        (${rawHeavyRun}, ${eventCapId}, 'many-events', ${start}),
        (${projectionHeavyRun}, ${projectionCapId}, 'many-projections', ${start})
    `)
      await db.execute(sql`
      INSERT INTO workflow_events (event_id, run_id, type, occurred_at)
      SELECT gen_random_uuid(), ${rawHeavyRun}::uuid, 'step', ${start}::timestamptz
      FROM generate_series(1, ${bounds.fallbackEvents + 30}::int)
    `)
      // Event inserts maintain facts. Remove just this fixture's fact to model an unbackfilled history.
      await db
        .delete(workflowRunFacts)
        .where(eq(workflowRunFacts.runId, rawHeavyRun))
      await db.execute(sql`
      INSERT INTO workflow_expectations (run_id, expectation_id)
      SELECT ${projectionHeavyRun}::uuid, 'expectation-' || i
      FROM generate_series(1, ${bounds.expectationProjections + 30}::int) g(i)
    `)

      assert.deepEqual(await Effect.runPromise(reading(query.workflow)), before)
      const explain = async (workflow: string) => {
        const rows = await db.execute<{
          "QUERY PLAN": [{ Plan: ExplainNode }]
        }>(
          sql`EXPLAIN (ANALYZE, FORMAT JSON)
            ${processHealthSql(projectId, { ...query, workflow }, observedAt, 0, 25, undefined)}`,
        )
        return planNodes(rows[0]!["QUERY PLAN"][0].Plan)
      }
      const sparse = await explain(query.workflow)
      assert.ok(
        sparse.some(
          (node) =>
            node["Subplan Name"] === "CTE selected_runs" &&
            node["Actual Rows"] === 2,
        ),
      )
      assert.ok(
        sparse.some(
          (node) => node["Index Name"] === "workflow_runs_workflow_started_idx",
        ),
      )
      assert.ok(
        sparse.some(
          (node) =>
            node["Subplan Name"] === "CTE fallback_events" &&
            node["Actual Rows"] === 2,
        ),
      )

      const budgets = [
        ["run-cap", "runs", "selected_runs", bounds.runs],
        [
          "event-cap",
          "fallback-events",
          "fallback_events",
          bounds.fallbackEvents,
        ],
        [
          "projection-cap",
          "expectation-projections",
          "projections",
          bounds.expectationProjections,
        ],
      ] as const
      for (const [workflow, name, cte, maximum] of budgets) {
        const failure = Result.getFailure(
          await Effect.runPromise(Effect.result(reading(workflow))),
        )
        assert.ok(
          Option.isSome(failure),
          `${workflow} should exceed its budget`,
        )
        assert.ok(
          failure.value instanceof ProcessHealthBudgetExceeded,
          `${workflow}: ${String(failure.value)}`,
        )
        assert.equal(failure.value.budget, name)
        const plan = await explain(workflow)
        assert.ok(
          plan.some(
            (node) =>
              node["Subplan Name"] === `CTE ${cte}` &&
              node["Actual Rows"] === maximum + 1,
          ),
        )
      }
    } finally {
      await close()
    }
  },
)
