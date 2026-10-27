import { sql } from "drizzle-orm"
import { projectRunSummaries } from "./run-summaries.js"

export const operationInsightsSql = (projectId: string) => sql`
  SELECT
    e.operation_name AS name,
    w.name AS workflow,
    count(*)::int AS count,
    count(*) FILTER (WHERE e.type = 'operation_failed')::int AS failed,
    coalesce(
      percentile_cont(0.5) WITHIN GROUP (ORDER BY e.duration_ms),
      0
    )::float8 AS "medianDurationMs",
    coalesce(
      percentile_cont(0.95) WITHIN GROUP (ORDER BY e.duration_ms),
      0
    )::float8 AS "p95DurationMs",
    coalesce(sum(e.duration_ms), 0)::float8 AS "totalDurationMs"
  FROM workflow_events e
  JOIN workflow_runs r ON r.id = e.run_id
  JOIN workflows w ON w.id = r.workflow_id
  WHERE w.project_id = ${projectId}
    AND e.type IN ('operation_completed', 'operation_failed')
    AND e.operation_name IS NOT NULL
  GROUP BY e.operation_name, w.name
  ORDER BY coalesce(sum(e.duration_ms), 0) DESC, count(*) DESC
  LIMIT 20
`

export const failureCodeInsightsSql = (projectId: string) => sql`
  SELECT
    e.error->>'code' AS code,
    w.name AS workflow,
    count(*)::int AS count
  FROM workflow_events e
  JOIN workflow_runs r ON r.id = e.run_id
  JOIN workflows w ON w.id = r.workflow_id
  WHERE w.project_id = ${projectId}
    AND e.type = 'failed'
    AND e.error->>'code' IS NOT NULL
    AND e.error->>'code' <> ''
  GROUP BY e.error->>'code', w.name
  ORDER BY count(*) DESC, code
  LIMIT 20
`

type IntelligenceWindow = {
  readonly startedAfter: string
  readonly startedBefore: string
}

export const intelligenceWindowSql = (
  projectId: string,
  workflow: string | undefined,
  current: IntelligenceWindow,
  previous: IntelligenceWindow,
) => sql`
  ${projectRunSummaries(projectId)},
  periods AS (
    SELECT
      'current' AS period,
      ${current.startedAfter}::timestamptz::text AS started_after,
      ${current.startedBefore}::timestamptz::text AS started_before,
      runs.*
    FROM runs
    WHERE "startedAt" >= ${current.startedAfter}::timestamptz
      AND "startedAt" < ${current.startedBefore}::timestamptz
      AND (${workflow ?? null}::text IS NULL OR workflow = ${workflow ?? null})
    UNION ALL
    SELECT
      'previous' AS period,
      ${previous.startedAfter}::timestamptz::text AS started_after,
      ${previous.startedBefore}::timestamptz::text AS started_before,
      runs.*
    FROM runs
    WHERE "startedAt" >= ${previous.startedAfter}::timestamptz
      AND "startedAt" < ${previous.startedBefore}::timestamptz
      AND (${workflow ?? null}::text IS NULL OR workflow = ${workflow ?? null})
  )
  SELECT
    period,
    started_after AS "startedAfter",
    started_before AS "startedBefore",
    count(*)::int AS "totalRuns",
    count(*) FILTER (WHERE status <> 'Running')::int AS "finishedRuns",
    count(*) FILTER (WHERE status = 'Completed')::int AS "completedRuns",
    count(*) FILTER (WHERE status = 'Failed')::int AS "failedRuns",
    round(
      100.0 * count(*) FILTER (WHERE status = 'Completed')
      / nullif(count(*) FILTER (WHERE status <> 'Running'), 0),
      1
    )::float8 AS "successRate",
    percentile_cont(0.5) WITHIN GROUP (ORDER BY "durationMs")
      FILTER (WHERE "durationMs" IS NOT NULL)::float8 AS "medianDurationMs",
    percentile_cont(0.95) WITHIN GROUP (ORDER BY "durationMs")
      FILTER (WHERE "durationMs" IS NOT NULL)::float8 AS "p95DurationMs"
  FROM periods
  GROUP BY period, started_after, started_before
  ORDER BY period
`

export const operationAttributionSql = (
  projectId: string,
  workflow: string | undefined,
  current: IntelligenceWindow,
  previous: IntelligenceWindow,
) => sql`
  SELECT
    CASE
      WHEN r.started_at >= ${current.startedAfter}::timestamptz
        AND r.started_at < ${current.startedBefore}::timestamptz
        THEN 'current'
      ELSE 'previous'
    END AS period,
    e.operation_name AS name,
    count(DISTINCT r.id)::int AS "runCount",
    percentile_cont(0.5) WITHIN GROUP (ORDER BY e.duration_ms)
      FILTER (WHERE e.duration_ms IS NOT NULL)::float8 AS "medianDurationMs",
    array_agg(DISTINCT r.id::text) FILTER (WHERE r.id IS NOT NULL) AS "runIds"
  FROM workflow_events e
  JOIN workflow_runs r ON r.id = e.run_id
  JOIN workflows w ON w.id = r.workflow_id
  WHERE w.project_id = ${projectId}
    AND e.type IN ('operation_completed', 'operation_failed')
    AND e.operation_name IS NOT NULL
    AND (
      (
        r.started_at >= ${current.startedAfter}::timestamptz
        AND r.started_at < ${current.startedBefore}::timestamptz
      )
      OR (
        r.started_at >= ${previous.startedAfter}::timestamptz
        AND r.started_at < ${previous.startedBefore}::timestamptz
      )
    )
    AND (
      ${workflow ?? null}::text IS NULL
      OR w.name = ${workflow ?? null}
    )
  GROUP BY period, e.operation_name
  ORDER BY e.operation_name, period
`

export const failureCodeAttributionSql = (
  projectId: string,
  workflow: string | undefined,
  current: IntelligenceWindow,
  previous: IntelligenceWindow,
) => sql`
  SELECT
    CASE
      WHEN r.started_at >= ${current.startedAfter}::timestamptz
        AND r.started_at < ${current.startedBefore}::timestamptz
        THEN 'current'
      ELSE 'previous'
    END AS period,
    e.error->>'code' AS code,
    count(DISTINCT r.id)::int AS count,
    array_agg(DISTINCT r.id::text) FILTER (WHERE r.id IS NOT NULL) AS "runIds"
  FROM workflow_events e
  JOIN workflow_runs r ON r.id = e.run_id
  JOIN workflows w ON w.id = r.workflow_id
  WHERE w.project_id = ${projectId}
    AND e.type = 'failed'
    AND e.error->>'code' IS NOT NULL
    AND e.error->>'code' <> ''
    AND (
      (
        r.started_at >= ${current.startedAfter}::timestamptz
        AND r.started_at < ${current.startedBefore}::timestamptz
      )
      OR (
        r.started_at >= ${previous.startedAfter}::timestamptz
        AND r.started_at < ${previous.startedBefore}::timestamptz
      )
    )
    AND (
      ${workflow ?? null}::text IS NULL
      OR w.name = ${workflow ?? null}
    )
  GROUP BY period, e.error->>'code'
  ORDER BY e.error->>'code', period
`
