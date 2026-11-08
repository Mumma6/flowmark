import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { test } from "node:test"
import { eq, sql } from "drizzle-orm"
import { Effect, Result } from "effect"
import { createDatabase } from "../../src/client.js"
import { Database, InvalidResultQuery } from "../../src/persistence/database.js"
import { getBusinessInsights } from "../../src/persistence/workflows/queries/get-business-insights.js"
import { getPeriodReport } from "../../src/persistence/workflows/queries/get-period-report.js"
import { getRelatedRunsPage } from "../../src/persistence/workflows/queries/get-related-runs-page.js"
import { getRunComparison } from "../../src/persistence/workflows/queries/get-run-comparison.js"
import { getRunEventPage } from "../../src/persistence/workflows/queries/get-run-event-page.js"
import { getRunExpectationsPage } from "../../src/persistence/workflows/queries/get-run-expectations-page.js"
import { getRunOperationsPage } from "../../src/persistence/workflows/queries/get-run-operations-page.js"
import { getRunTimeline } from "../../src/persistence/workflows/queries/get-run-timeline.js"
import { listRuns } from "../../src/persistence/workflows/queries/list-runs.js"
import { getWorkflowDiscoveryPage } from "../../src/persistence/workflows/queries/get-workflow-discovery-page.js"
import {
  workflowEvents,
  workflowRuns,
  workflows,
} from "../../src/schema/index.js"
import { encodeWorkflowDiscoveryCursor } from "../../src/persistence/workflows/workflow-discovery-cursor.js"
import { runTimelineJoins } from "../../src/persistence/workflows/queries/run-timeline-mapping.js"

const url = process.env.TEST_DATABASE_URL
const serializedToolBudget = 64 * 1024
const marker = "BOUNDED-PAYLOAD"

test(
  "bounded reads page large histories without changing analytics or the full timeline",
  { skip: !url },
  async () => {
    assert.ok(
      ["localhost", "127.0.0.1", "[::1]"].includes(new URL(url!).hostname),
      "disposable loopback TEST_DATABASE_URL required",
    )
    const { db, close } = createDatabase(url!)
    const workspace = randomUUID()
    const project = randomUUID()
    const other = randomUUID()
    const pagesWorkflow = randomUUID()
    const outcomesWorkflow = randomUUID()
    const otherWorkflow = randomUUID()
    const dense = randomUUID()
    const rawRun = randomUUID()
    const otherRun = randomUUID()
    const ratioA = randomUUID()
    const ratioB = randomUUID()
    const missing = randomUUID()
    const incompatible = randomUUID()
    const wrongType = randomUUID()
    const run = <A, E>(effect: Effect.Effect<A, E, typeof db>) =>
      Effect.runPromise(
        Effect.result(effect).pipe(Effect.provideService(Database, db)),
      )
    const walk = async <T>(
      read: (
        cursor?: string,
      ) => Effect.Effect<
        { readonly nextCursor: string | null; readonly rows: readonly T[] },
        InvalidResultQuery,
        typeof db
      >,
    ) => {
      const collect = async (
        cursor: string | undefined,
        rows: readonly T[],
      ): Promise<readonly T[]> => {
        const page = Result.getOrThrow(await run(read(cursor)))
        const next = rows.concat(page.rows)
        return page.nextCursor ? collect(page.nextCursor, next) : next
      }
      return collect(undefined, [])
    }
    try {
      await db.execute(
        sql`INSERT INTO workspaces(id, name) VALUES (${workspace}, 'bounded-read-parity')`,
      )
      await db.execute(sql`
        INSERT INTO projects(id, workspace_id, name)
        VALUES (${project}, ${workspace}, 'parity'), (${other}, ${workspace}, 'other')
      `)
      await db.execute(sql`
        INSERT INTO workflows(id, project_id, name) VALUES
          (${pagesWorkflow}, ${project}, 'parity.pages'),
          (${outcomesWorkflow}, ${project}, 'parity.outcomes'),
          (${otherWorkflow}, ${other}, 'parity.pages')
      `)
      await db.execute(sql`
        INSERT INTO workflow_result_declarations
          (project_id, workflow, revision, declaration)
        VALUES (
          ${project}, 'parity.outcomes', 'v1',
          ${JSON.stringify({
            revision: "v1",
            fields: [
              {
                path: ["saved"],
                label: "Saved",
                kind: "count",
                aggregate: true,
              },
              {
                path: ["input"],
                label: "Input",
                kind: "count",
                aggregate: true,
              },
            ],
          })}::jsonb
        )
      `)
      await db.execute(sql`
        INSERT INTO workflow_runs
          (id, workflow_id, external_id, started_at, correlation_id, outcome, environment, release)
        VALUES
          (${dense}, ${pagesWorkflow}, 'dense', '2026-06-01T00:00:00Z', 'cohort-1', null, 'prod', 'r1'),
          (${otherRun}, ${otherWorkflow}, 'foreign-dense', '2026-06-01T00:00:00Z', 'cohort-1', null, 'prod', 'r1'),
          (${ratioA}, ${outcomesWorkflow}, 'ratio-a', '2026-10-02T00:00:00Z', null, 'kept', 'prod', 'r1'),
          (${ratioB}, ${outcomesWorkflow}, 'ratio-b', '2026-10-03T00:00:00Z', null, 'kept', 'prod', 'r1'),
          (${missing}, ${outcomesWorkflow}, 'missing-field', '2026-10-04T00:00:00Z', null, 'kept', 'prod', 'r1'),
          (${incompatible}, ${outcomesWorkflow}, 'other-revision', '2026-10-05T00:00:00Z', null, 'kept', 'prod', 'r1'),
          (${wrongType}, ${outcomesWorkflow}, 'wrong-type', '2026-10-06T00:00:00Z', null, 'kept', 'prod', 'r1'),
          (${rawRun}, ${pagesWorkflow}, 'raw-fallback', '2026-03-01T00:00:00Z', null, 'kept', 'prod', 'r1')
      `)
      await db.execute(sql`
        INSERT INTO workflow_runs
          (id, workflow_id, external_id, started_at, correlation_id)
        SELECT gen_random_uuid(), ${pagesWorkflow}, 'listed-' || g.i,
          '2026-04-01T00:00:00Z'::timestamptz + g.i * interval '1 minute', null
        FROM generate_series(1, 110) AS g(i)
      `)
      await db.execute(sql`
        INSERT INTO workflow_runs
          (id, workflow_id, external_id, started_at, correlation_id)
        SELECT gen_random_uuid(), ${pagesWorkflow}, 'related-' || g.i,
          '2026-05-01T00:00:00Z'::timestamptz + g.i * interval '1 minute', 'cohort-1'
        FROM generate_series(1, 30) AS g(i)
      `)
      await db.execute(sql`
        INSERT INTO workflow_runs
          (id, workflow_id, external_id, started_at, correlation_id)
        SELECT gen_random_uuid(), ${otherWorkflow}, 'foreign-related-' || g.i,
          '2026-05-01T00:00:00Z'::timestamptz + g.i * interval '1 minute', 'cohort-1'
        FROM generate_series(1, 5) AS g(i)
      `)
      await db.execute(sql`
        INSERT INTO workflow_run_facts
          (run_id, version, source_receipt, selection, status)
        SELECT id, 1, 1, '{}'::jsonb, 'Completed'
        FROM workflow_runs
        WHERE workflow_id IN (${pagesWorkflow}, ${otherWorkflow})
          AND id NOT IN (${dense}, ${rawRun})
      `)
      await db.execute(sql`
        INSERT INTO workflow_events
          (event_id, run_id, type, occurred_at, created_at, properties)
        VALUES (
          ${randomUUID()}, ${dense}, 'report', '2026-05-31T00:00:00Z', '2026-05-31T00:00:00Z',
          ${JSON.stringify({ payload: `${marker}${"x".repeat(20_000)}` })}::jsonb
        )
      `)
      await db.execute(sql`
        INSERT INTO workflow_events
          (event_id, run_id, type, occurred_at, created_at, step)
        SELECT gen_random_uuid(), ${dense}, 'step',
          '2026-06-01T00:00:00Z'::timestamptz + g.i * interval '1 second',
          '2026-06-01T00:00:01Z'::timestamptz + g.i * interval '1 millisecond',
          'step-' || g.i
        FROM generate_series(1, 120) AS g(i)
      `)
      await db.execute(sql`
        INSERT INTO workflow_events
          (event_id, run_id, type, occurred_at, operation_id, operation_name)
        SELECT gen_random_uuid(), ${dense}, 'operation_started',
          '2026-06-02T00:00:00.123456Z'::timestamptz,
          (lpad((41 - g.i)::text, 8, '0') || '-0000-0000-0000-000000000000')::uuid, 'op-' || g.i
        FROM generate_series(1, 40) AS g(i)
      `)
      await db.execute(sql`
        INSERT INTO workflow_expectations
          (id, run_id, expectation_id, declared_at, deadline_at)
        SELECT gen_random_uuid(), ${dense}, 'exp-' || g.i,
          '2026-06-03T00:00:00Z'::timestamptz + g.i * interval '1 second',
          '2026-06-03T00:00:00Z'::timestamptz + g.i * interval '1 second' + interval '1 second'
        FROM generate_series(1, 40) AS g(i)
      `)
      await db.execute(sql`
        WITH events AS (
          INSERT INTO workflow_events (
            id, event_id, run_id, type, occurred_at, expectation_effective,
            expectation_owner_id, expectation, expectation_observed_at
          )
          SELECT gen_random_uuid(), gen_random_uuid(), ${dense}, 'expectation_declared',
            expectations.declared_at, true, expectations.id,
            jsonb_build_object(
              'type', 'expectation_declared',
              'expectationId', expectations.expectation_id,
              'workflow', 'parity.pages',
              'runId', 'dense',
              'timestamp', expectations.declared_at,
              'name', 'saved',
              'withinMs', 1000
            ),
            expectations.declared_at
          FROM workflow_expectations AS expectations
          WHERE expectations.run_id = ${dense}
          RETURNING id, expectation_owner_id
        )
        UPDATE workflow_expectations AS expectations
        SET declaration_event_id = events.id
        FROM events
        WHERE events.expectation_owner_id = expectations.id
      `)
      await db.execute(sql`
        INSERT INTO workflow_events (event_id, run_id, type, occurred_at, properties, result)
        VALUES
          (${randomUUID()}, ${ratioA}, 'started', '2026-10-02T00:00:00Z', '{"definitionRevision":"v1"}'::jsonb, null),
          (${randomUUID()}, ${ratioA}, 'completed', '2026-10-02T00:01:00Z', null, '{"saved":1,"input":2}'::jsonb),
          (${randomUUID()}, ${ratioB}, 'started', '2026-10-03T00:00:00Z', '{"definitionRevision":"v1"}'::jsonb, null),
          (${randomUUID()}, ${ratioB}, 'completed', '2026-10-03T00:01:00Z', null, '{"saved":9,"input":100}'::jsonb),
          (${randomUUID()}, ${missing}, 'started', '2026-10-04T00:00:00Z', '{"definitionRevision":"v1"}'::jsonb, null),
          (${randomUUID()}, ${missing}, 'completed', '2026-10-04T00:01:00Z', null, '{"note":1}'::jsonb),
          (${randomUUID()}, ${incompatible}, 'started', '2026-10-05T00:00:00Z', '{"definitionRevision":"other"}'::jsonb, null),
          (${randomUUID()}, ${incompatible}, 'completed', '2026-10-05T00:01:00Z', null, '{"saved":999,"input":1}'::jsonb),
          (${randomUUID()}, ${wrongType}, 'started', '2026-10-06T00:00:00Z', '{"definitionRevision":"v1"}'::jsonb, null),
          (${randomUUID()}, ${wrongType}, 'completed', '2026-10-06T00:01:00Z', null, '{"saved":null,"input":1}'::jsonb),
          (${randomUUID()}, ${rawRun}, 'completed', '2026-03-01T00:01:00Z', null, '{"saved":0}'::jsonb)
      `)
      await db.execute(
        sql`DELETE FROM workflow_run_facts WHERE run_id = ${rawRun}`,
      )

      const limited = Result.getOrThrow(
        await run(getRunEventPage(project, { runId: dense, limit: 500 })),
      )
      assert.equal(limited.limit, 100)
      assert.equal(limited.events.length, 100)
      assert.ok(limited.nextCursor)
      assert.ok(limited.totalEvents > 100)
      assert.ok(
        Buffer.byteLength(JSON.stringify(limited)) < serializedToolBudget,
      )
      assert.equal(JSON.stringify(limited).includes(`${marker}xxx`), false)
      const explained = db
        .select({ id: workflowEvents.eventId })
        .from(workflowEvents)
        .innerJoin(workflowRuns, eq(workflowEvents.runId, workflowRuns.id))
        .innerJoin(workflows, eq(workflowRuns.workflowId, workflows.id))
        .where(runTimelineJoins(project, dense))
        .orderBy(
          workflowEvents.occurredAt,
          workflowEvents.createdAt,
          workflowEvents.eventId,
        )
        .limit(limited.limit + 1)
        .toSQL()
      const planText = explained.params.reduceRight(
        (statement, value, index) =>
          statement.replaceAll(
            `$${index + 1}`,
            typeof value === "string" ? `'${value}'` : String(value),
          ),
        explained.sql,
      )
      const [plan] = await db.execute<{ "QUERY PLAN": unknown }>(
        sql.raw(`EXPLAIN (FORMAT JSON) ${planText}`),
      )
      assert.match(JSON.stringify(plan), /Limit/)

      const timeline = Result.getOrThrow(
        await run(getRunTimeline(project, dense)),
      )
      const paged = await walk((cursor) =>
        getRunEventPage(project, { runId: dense, limit: 50, cursor }).pipe(
          Effect.map((page) => ({
            nextCursor: page.nextCursor,
            rows: page.events.map((event) => event.id),
          })),
        ),
      )
      assert.deepEqual(
        paged,
        timeline.map((event) => event.id),
      )
      assert.equal(new Set(paged).size, paged.length)
      assert.ok(
        timeline.some((event) =>
          JSON.stringify(event.properties ?? {}).includes(marker),
        ),
      )

      const first = Result.getOrThrow(
        await run(getRunEventPage(project, { runId: dense, limit: 50 })),
      )
      assert.ok(first.nextCursor)
      const lateId = randomUUID()
      const earlyId = randomUUID()
      await db.execute(sql`
        INSERT INTO workflow_events (event_id, run_id, type, occurred_at, created_at, step)
        VALUES
          (${lateId}, ${dense}, 'step', '2026-07-01T00:00:00Z', '2026-07-01T00:00:00Z', 'appended-late'),
          (${earlyId}, ${dense}, 'step', '2026-05-01T00:00:00Z', '2026-05-01T00:00:00Z', 'appended-early')
      `)
      const rest = await walk((cursor) =>
        getRunEventPage(project, {
          runId: dense,
          limit: 50,
          cursor: cursor ?? first.nextCursor!,
        }).pipe(
          Effect.map((page) => ({
            nextCursor: page.nextCursor,
            rows: page.events.map((event) => event.id),
          })),
        ),
      )
      assert.equal(rest.filter((id) => id === lateId).length, 1)
      assert.equal(rest.includes(earlyId), false)
      assert.equal(
        first.events.some((event) => event.id === earlyId),
        false,
      )
      const afterAppend = Result.getOrThrow(
        await run(getRunTimeline(project, dense)),
      )
      assert.equal(
        afterAppend.filter((event) => event.id === earlyId).length,
        1,
      )
      assert.equal(afterAppend.filter((event) => event.id === lateId).length, 1)

      const listed = await walk((cursor) =>
        listRuns(project, {
          workflow: "parity.pages",
          limit: 100,
          cursor,
        }).pipe(
          Effect.map((page) => ({
            nextCursor: page.nextCursor,
            rows: page.runs.map((item) => item.id),
          })),
        ),
      )
      assert.ok(listed.length > 100)
      assert.equal(new Set(listed).size, listed.length)
      assert.equal(listed.includes(otherRun), false)
      const raw = Result.getOrThrow(
        await run(
          listRuns(project, {
            workflow: "parity.pages",
            externalId: "raw-fallback",
          }),
        ),
      )
      assert.equal(raw.runs[0]?.status, "Completed")
      assert.equal(raw.runs[0]?.id, rawRun)

      const related = await walk((cursor) =>
        getRelatedRunsPage(project, { runId: dense, limit: 25, cursor }).pipe(
          Effect.map((page) => ({
            nextCursor: page.nextCursor,
            rows: page.items.map((item) => item.id),
          })),
        ),
      )
      assert.ok(related.length > 25)
      assert.equal(new Set(related).size, related.length)
      assert.equal(related.includes(otherRun), false)
      const operations = Result.getOrThrow(
        await run(getRunOperationsPage(project, { runId: dense, limit: 25 })),
      )
      assert.equal(operations.operations.length, 25)
      assert.equal(operations.totalOperations, 40)
      assert.ok(operations.nextCursor)
      const allOperations = await walk((cursor) =>
        getRunOperationsPage(project, { runId: dense, limit: 7, cursor }).pipe(
          Effect.map((page) => ({
            nextCursor: page.nextCursor,
            rows: page.operations.map((item) => item.operationId),
          })),
        ),
      )
      assert.equal(allOperations.length, 40)
      assert.equal(new Set(allOperations).size, 40)
      assert.deepEqual(allOperations, [...allOperations].sort())
      const expectations = Result.getOrThrow(
        await run(getRunExpectationsPage(project, { runId: dense, limit: 25 })),
      )
      assert.equal(expectations.expectations.length, 25)
      assert.equal(expectations.totalRecords, 40)
      assert.ok(expectations.nextCursor)

      const deniedRun = await run(
        getRunEventPage(project, { runId: otherRun, limit: 10 }),
      )
      const deniedCursor = await run(
        getRunEventPage(project, { runId: dense, cursor: "not-a-cursor" }),
      )
      const deniedDiscovery = await run(
        getWorkflowDiscoveryPage(project, {
          cursor: encodeWorkflowDiscoveryCursor({
            projectId: other,
            name: "parity.pages",
          }),
        }),
      )
      ;[deniedRun, deniedCursor, deniedDiscovery].forEach((denied) =>
        Result.match(denied, {
          onFailure: (error) => assert.ok(error instanceof InvalidResultQuery),
          onSuccess: () =>
            assert.fail("foreign or malformed cursor was accepted"),
        }),
      )

      const insights = Result.getOrThrow(
        await run(
          getBusinessInsights(project, {
            workflow: "parity.outcomes",
            revision: "v1",
            path: ["saved"],
            numerator: ["saved"],
            denominator: ["input"],
            currentStartedAfter: "2026-10-01T00:00:00.000Z",
            currentStartedBefore: "2026-10-08T00:00:00.000Z",
            previousStartedAfter: "2026-09-24T00:00:00.000Z",
            previousStartedBefore: "2026-10-01T00:00:00.000Z",
          }),
        ),
      )
      const current = insights.windows.find(
        (window) => window.scope === "current",
      )
      const previous = insights.windows.find(
        (window) => window.scope === "previous",
      )
      assert.ok(current)
      assert.equal(current.knownRuns, 2)
      assert.equal(current.total, "10")
      assert.equal(current.missingField, 1)
      assert.equal(current.incompatibleRevision, 1)
      assert.equal(current.wrongType, 1)
      assert.equal(current.ratio.numerator, "10")
      assert.equal(current.ratio.denominator, "102")
      assert.equal(previous?.totalRuns, 0)
      assert.equal(previous?.total, null)
      const report = Result.getOrThrow(
        await run(
          getPeriodReport(project, {
            workflow: "parity.outcomes",
            currentStartedAfter: "2026-10-01T00:00:00.000Z",
            currentStartedBefore: "2026-10-08T00:00:00.000Z",
            previousStartedAfter: "2026-09-24T00:00:00.000Z",
            previousStartedBefore: "2026-10-01T00:00:00.000Z",
          }),
        ),
      )
      const outcomePeriod = report.workflows.find(
        (workflow) => workflow.name === "parity.outcomes",
      )
      assert.equal(outcomePeriod?.current.finishedRuns, 5)
      assert.equal(outcomePeriod?.previous.finishedRuns, 0)
      const comparison = Result.getOrThrow(
        await run(getRunComparison(project, wrongType)),
      )
      assert.equal(comparison.current?.id, wrongType)
      assert.equal(comparison.peers.length, 4)
      assert.equal(
        comparison.peers.some((peer) => peer.id === otherRun),
        false,
      )
    } finally {
      await close()
    }
  },
)
