import { and, eq, sql } from "drizzle-orm"
import { Effect } from "effect"
import type { WorkflowResult } from "@flowmark/core"
import { workflowEvents, workflowRuns, workflows } from "../schema.js"
import { Database, DatabaseError } from "./database.js"

export type StoredRun = {
  id: string
  externalId: string
  workflow: string
  startedAt: string
  status: "Completed" | "Failed" | "Running"
  durationMs: number | null
  step: string | null
  result: WorkflowResult | null
  correlationId: string | null
  parentRunId: string | null
}

export type WorkflowSummary = {
  name: string
  runs: number
  successRate: number | null
  medianDurationMs: number
}

const runSummary = (projectId: string) => sql`
  WITH runs AS (
    SELECT r.id, r.external_id AS "externalId", w.name AS workflow,
      r.started_at AS "startedAt",
      r.correlation_id AS "correlationId",
      r.parent_run_id AS "parentRunId",
      CASE WHEN bool_or(e.type = 'failed') THEN 'Failed'
        WHEN bool_or(e.type = 'completed') THEN 'Completed'
        ELSE 'Running' END AS status,
      (extract(epoch FROM (max(e.occurred_at) FILTER (WHERE e.type IN ('completed', 'failed')) - r.started_at)) * 1000)::float8 AS "durationMs",
      (array_agg(e.step ORDER BY e.occurred_at DESC, e.created_at DESC) FILTER (WHERE e.step IS NOT NULL))[1] AS step,
      (array_agg(e.result ORDER BY e.occurred_at DESC, e.created_at DESC)
        FILTER (WHERE e.type = 'completed' AND e.result IS NOT NULL))[1] AS result
    FROM workflow_runs r JOIN workflows w ON w.id = r.workflow_id
    LEFT JOIN workflow_events e ON e.run_id = r.id
    WHERE w.project_id = ${projectId}
    GROUP BY r.id, w.name
  )
`

export const readSnapshot = Effect.fn("readSnapshot")(function* (
  projectId: string,
) {
  const db = yield* Database
  return yield* Effect.tryPromise({
    try: async () => {
      const runs = await db.execute<StoredRun>(sql`${runSummary(projectId)}
        SELECT id, "externalId", workflow, "startedAt"::text AS "startedAt", status, "durationMs", step, result, "correlationId", "parentRunId"
        FROM runs ORDER BY runs."startedAt" DESC LIMIT 100`)
      const summaries =
        await db.execute<WorkflowSummary>(sql`${runSummary(projectId)}
        SELECT workflow AS name, count(*)::int AS runs,
          round(100.0 * count(*) FILTER (WHERE status = 'Completed') /
            nullif(count(*) FILTER (WHERE status != 'Running'), 0), 1)::float8 AS "successRate",
          coalesce(percentile_cont(0.5) WITHIN GROUP (ORDER BY "durationMs"), 0)::float8 AS "medianDurationMs"
        FROM runs GROUP BY workflow ORDER BY workflow`)
      const [metrics] = await db.execute<{
        totalRuns: number
        failedRuns: number
        successRate: number | null
        medianDurationMs: number
      }>(sql`${runSummary(projectId)}
        SELECT count(*)::int AS "totalRuns", count(*) FILTER (WHERE status = 'Failed')::int AS "failedRuns",
          round(100.0 * count(*) FILTER (WHERE status = 'Completed') /
            nullif(count(*) FILTER (WHERE status != 'Running'), 0), 1)::float8 AS "successRate",
          coalesce(percentile_cont(0.5) WITHIN GROUP (ORDER BY "durationMs"), 0)::float8 AS "medianDurationMs"
        FROM runs`)
      const daily = await db.execute<{
        date: string
        count: number
      }>(sql`${runSummary(projectId)}
        SELECT to_char(day, 'YYYY-MM-DD') AS date, count(runs.id)::int AS count
        FROM generate_series(current_date - 29, current_date, interval '1 day') day
        LEFT JOIN runs ON ("startedAt" AT TIME ZONE 'UTC')::date = day::date
        GROUP BY day ORDER BY day`)
      return {
        runs: Array.from(runs),
        workflows: Array.from(summaries),
        metrics,
        daily: Array.from(daily),
      }
    },
    catch: (cause) => new DatabaseError({ operation: "read-snapshot", cause }),
  })
})

export const readRun = Effect.fn("readRun")(function* (
  projectId: string,
  runId: string,
) {
  const db = yield* Database
  return yield* Effect.tryPromise({
    try: async () => {
      const rows = await db
        .select({
          id: workflowEvents.eventId,
          type: workflowEvents.type,
          step: workflowEvents.step,
          operationId: workflowEvents.operationId,
          operationName: workflowEvents.operationName,
          durationMs: workflowEvents.durationMs,
          completed: workflowEvents.progressCompleted,
          total: workflowEvents.progressTotal,
          unit: workflowEvents.progressUnit,
          reason: workflowEvents.reason,
          properties: workflowEvents.properties,
          error: workflowEvents.error,
          result: workflowEvents.result,
          timestamp: workflowEvents.occurredAt,
          receivedAt: workflowEvents.createdAt,
          workflow: workflows.name,
          externalId: workflowRuns.externalId,
          environment: workflowRuns.environment,
          release: workflowRuns.release,
          correlationId: workflowRuns.correlationId,
          parentRunId: workflowRuns.parentRunId,
        })
        .from(workflowEvents)
        .innerJoin(workflowRuns, eq(workflowEvents.runId, workflowRuns.id))
        .innerJoin(workflows, eq(workflowRuns.workflowId, workflows.id))
        .where(
          and(eq(workflows.projectId, projectId), eq(workflowRuns.id, runId)),
        )
        .orderBy(workflowEvents.occurredAt, workflowEvents.createdAt)
      return rows.map((row) => ({
        ...row,
        timestamp: row.timestamp.toISOString(),
        receivedAt: row.receivedAt.toISOString(),
        properties: row.properties ?? null,
        error: row.error ?? null,
        result: row.result ?? null,
        environment: row.environment ?? null,
        release: row.release ?? null,
        correlationId: row.correlationId ?? null,
        parentRunId: row.parentRunId ?? null,
      }))
    },
    catch: (cause) => new DatabaseError({ operation: "read-run", cause }),
  })
})

export type RelatedRun = {
  id: string
  externalId: string
  workflow: string
  startedAt: string
  status: "Completed" | "Failed" | "Running"
  correlationId: string | null
  parentRunId: string | null
}

export const readRelatedRuns = Effect.fn("readRelatedRuns")(function* (
  projectId: string,
  runId: string,
) {
  const db = yield* Database
  return yield* Effect.tryPromise({
    try: async () => {
      const rows = await db.execute<
        RelatedRun & { relationship: "parent" | "correlated" }
      >(sql`WITH current AS (
          SELECT r.id, r.external_id AS "externalId",
            r.correlation_id AS "correlationId",
            r.parent_run_id AS "parentRunId"
          FROM workflow_runs r
          JOIN workflows w ON w.id = r.workflow_id
          WHERE w.project_id = ${projectId} AND r.id = ${runId}
        ), candidates AS (
          SELECT r.id, r.external_id AS "externalId", w.name AS workflow,
            r.started_at AS "startedAt", r.correlation_id AS "correlationId",
            r.parent_run_id AS "parentRunId"
          FROM workflow_runs r
          JOIN workflows w ON w.id = r.workflow_id
          CROSS JOIN current
          WHERE w.project_id = ${projectId}
            AND r.id != current.id
            AND (
              (current."parentRunId" IS NOT NULL
                AND r.external_id = current."parentRunId")
              OR
              (current."correlationId" IS NOT NULL
                AND r.correlation_id = current."correlationId")
            )
        ), runs AS (
          SELECT candidate.id, candidate."externalId", candidate.workflow,
            candidate."startedAt", candidate."correlationId",
            candidate."parentRunId",
            CASE WHEN bool_or(e.type = 'failed') THEN 'Failed'
              WHEN bool_or(e.type = 'completed') THEN 'Completed'
              ELSE 'Running' END AS status
          FROM candidates candidate
          LEFT JOIN workflow_events e ON e.run_id = candidate.id
          GROUP BY candidate.id, candidate."externalId", candidate.workflow,
            candidate."startedAt", candidate."correlationId",
            candidate."parentRunId"
        )
        SELECT candidate.id, candidate."externalId", candidate.workflow,
          candidate."startedAt"::text AS "startedAt", candidate.status,
          candidate."correlationId", candidate."parentRunId",
          CASE
            WHEN current."parentRunId" IS NOT NULL
              AND candidate."externalId" = current."parentRunId" THEN 'parent'
            ELSE 'correlated'
          END AS relationship
        FROM runs candidate CROSS JOIN current
        ORDER BY candidate."startedAt", candidate.id`)
      const toRelatedRun = (row: RelatedRun) => ({
        id: row.id,
        externalId: row.externalId,
        workflow: row.workflow,
        startedAt: row.startedAt,
        status: row.status,
        correlationId: row.correlationId,
        parentRunId: row.parentRunId,
      })
      return {
        parentMatches: Array.from(rows)
          .filter((row) => row.relationship === "parent")
          .map(toRelatedRun),
        related: Array.from(rows)
          .filter((row) => row.relationship === "correlated")
          .map(toRelatedRun),
      }
    },
    catch: (cause) =>
      new DatabaseError({ operation: "read-related-runs", cause }),
  })
})
