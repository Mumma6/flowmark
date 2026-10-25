import { sql } from "drizzle-orm"

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
