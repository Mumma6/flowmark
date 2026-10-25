import { sql } from "drizzle-orm"

/**
 * One row per project run, with last-reported terminal status.
 * Failed wins over completed; missing terminal events stay Running.
 */
export const projectRunSummaries = (projectId: string) => sql`
  WITH runs AS (
    SELECT
      r.id,
      r.external_id AS "externalId",
      w.name AS workflow,
      r.started_at AS "startedAt",
      r.correlation_id AS "correlationId",
      r.parent_run_id AS "parentRunId",
      CASE
        WHEN bool_or(e.type = 'failed') THEN 'Failed'
        WHEN bool_or(e.type = 'completed') THEN 'Completed'
        ELSE 'Running'
      END AS status,
      (
        extract(epoch FROM (
          max(e.occurred_at) FILTER (WHERE e.type IN ('completed', 'failed'))
          - r.started_at
        )) * 1000
      )::float8 AS "durationMs",
      (
        array_agg(e.step ORDER BY e.occurred_at DESC, e.created_at DESC)
        FILTER (WHERE e.step IS NOT NULL)
      )[1] AS step,
      (
        array_agg(e.result ORDER BY e.occurred_at DESC, e.created_at DESC)
        FILTER (WHERE e.type = 'completed' AND e.result IS NOT NULL)
      )[1] AS result
    FROM workflow_runs r
    JOIN workflows w ON w.id = r.workflow_id
    LEFT JOIN workflow_events e ON e.run_id = r.id
    WHERE w.project_id = ${projectId}
    GROUP BY r.id, w.name
  )
`

export const recentRunsSql = (projectId: string) => sql`
  ${projectRunSummaries(projectId)}
  SELECT
    id,
    "externalId",
    workflow,
    "startedAt"::text AS "startedAt",
    status,
    "durationMs",
    step,
    result,
    "correlationId",
    "parentRunId"
  FROM runs
  ORDER BY runs."startedAt" DESC
  LIMIT 100
`

export const workflowSummariesSql = (projectId: string) => sql`
  ${projectRunSummaries(projectId)}
  SELECT
    workflow AS name,
    count(*)::int AS runs,
    round(
      100.0 * count(*) FILTER (WHERE status = 'Completed')
      / nullif(count(*) FILTER (WHERE status != 'Running'), 0),
      1
    )::float8 AS "successRate",
    coalesce(
      percentile_cont(0.5) WITHIN GROUP (ORDER BY "durationMs"),
      0
    )::float8 AS "medianDurationMs"
  FROM runs
  GROUP BY workflow
  ORDER BY workflow
`

export const projectMetricsSql = (projectId: string) => sql`
  ${projectRunSummaries(projectId)}
  SELECT
    count(*)::int AS "totalRuns",
    count(*) FILTER (WHERE status = 'Failed')::int AS "failedRuns",
    round(
      100.0 * count(*) FILTER (WHERE status = 'Completed')
      / nullif(count(*) FILTER (WHERE status != 'Running'), 0),
      1
    )::float8 AS "successRate",
    coalesce(
      percentile_cont(0.5) WITHIN GROUP (ORDER BY "durationMs"),
      0
    )::float8 AS "medianDurationMs"
  FROM runs
`

export const dailyVolumeSql = (projectId: string) => sql`
  ${projectRunSummaries(projectId)}
  SELECT
    to_char(day, 'YYYY-MM-DD') AS date,
    count(runs.id)::int AS count
  FROM generate_series(
    current_date - 29,
    current_date,
    interval '1 day'
  ) day
  LEFT JOIN runs ON ("startedAt" AT TIME ZONE 'UTC')::date = day::date
  GROUP BY day
  ORDER BY day
`
