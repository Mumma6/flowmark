import { sql } from "drizzle-orm"

type BusinessFilter = {
  workflow?: string
  businessKey?: string
  businessValue?: string
}
const businessPredicate = (projectId: string, filter?: BusinessFilter) =>
  filter?.businessKey === undefined
    ? sql`true`
    : sql`
  w.name = ${filter.workflow ?? null}
  AND jsonb_typeof(r.properties -> ${filter.businessKey}::text) = 'string'
  AND r.properties @> jsonb_build_object(${filter.businessKey}::text, ${filter.businessValue ?? null}::text)
  AND EXISTS (
    SELECT 1 FROM workflow_search_fields config,
    jsonb_array_elements(config.fields) field
    WHERE config.project_id = ${projectId} AND config.workflow = w.name
    AND field ->> 'key' = ${filter.businessKey}
    AND (field ->> 'role' = 'lookup' OR (field ->> 'role' = 'dimension' AND (field -> 'values') ? ${filter.businessValue ?? ""}))
  )
`
/**
 * One row per project run, with last-reported terminal status.
 * Failed wins over completed; missing terminal events stay Running.
 */
export const projectRunSummaries = (
  projectId: string,
  business?: BusinessFilter,
) => sql`
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
        FILTER (WHERE e.type IN ('completed', 'failed') AND e.result IS NOT NULL)
      )[1] AS result,
      r.outcome AS outcome,
      max(r.environment) AS environment,
      max(r.release) AS release,
      (
        array_agg(e.error ->> 'code' ORDER BY e.occurred_at DESC, e.created_at DESC)
        FILTER (WHERE e.type = 'failed' AND e.error ->> 'code' IS NOT NULL)
      )[1] AS "failCode"
    FROM workflow_runs r
    JOIN workflows w ON w.id = r.workflow_id
    LEFT JOIN workflow_events e ON e.run_id = r.id
    WHERE w.project_id = ${projectId} AND ${businessPredicate(projectId, business)}
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
    outcome,
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
    )::float8 AS "medianDurationMs",
    coalesce(
      percentile_cont(0.95) WITHIN GROUP (ORDER BY "durationMs"),
      0
    )::float8 AS "p95DurationMs"
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
    )::float8 AS "medianDurationMs",
    coalesce(
      percentile_cont(0.95) WITHIN GROUP (ORDER BY "durationMs"),
      0
    )::float8 AS "p95DurationMs"
  FROM runs
`

export const dailyInsightsSql = (projectId: string) => sql`
  ${projectRunSummaries(projectId)}
  SELECT
    to_char(day, 'YYYY-MM-DD') AS date,
    count(runs.id)::int AS count,
    count(runs.id) FILTER (WHERE status = 'Completed')::int AS completed,
    count(runs.id) FILTER (WHERE status = 'Failed')::int AS failed,
    round(
      100.0 * count(runs.id) FILTER (WHERE status = 'Completed')
      / nullif(count(runs.id) FILTER (WHERE status != 'Running'), 0),
      1
    )::float8 AS "successRate",
    percentile_cont(0.5) WITHIN GROUP (ORDER BY "durationMs")::float8
      AS "medianDurationMs",
    percentile_cont(0.95) WITHIN GROUP (ORDER BY "durationMs")::float8
      AS "p95DurationMs"
  FROM generate_series(
    current_date - 29,
    current_date,
    interval '1 day'
  ) day
  LEFT JOIN runs ON ("startedAt" AT TIME ZONE 'UTC')::date = day::date
  GROUP BY day
  ORDER BY day
`

export const currentRunSql = (projectId: string, runId: string) => sql`
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
    outcome,
    "correlationId",
    "parentRunId"
  FROM runs
  WHERE id = ${runId}
`

export const peerRunsSql = (projectId: string, runId: string) => sql`
  ${projectRunSummaries(projectId)},
  current_run AS (
    SELECT workflow, id FROM runs WHERE id = ${runId}
  )
  SELECT
    runs.id,
    runs."externalId",
    runs.workflow,
    runs."startedAt"::text AS "startedAt",
    runs.status,
    runs."durationMs",
    runs.step,
    runs.result,
    runs.outcome,
    runs."correlationId",
    runs."parentRunId"
  FROM runs
  JOIN current_run ON current_run.workflow = runs.workflow
  WHERE runs.id != current_run.id
  ORDER BY runs."startedAt" DESC
  LIMIT 50
`

export type ListRunsFilter = {
  readonly businessKey?: string
  readonly businessValue?: string
  readonly workflow?: string
  readonly status?: "Completed" | "Failed" | "Running"
  readonly search?: string
  readonly externalId?: string
  readonly failCode?: string
  readonly environment?: string
  readonly release?: string
  readonly correlationId?: string
  readonly parentRunId?: string
  readonly namespace?: "browser" | "application"
  readonly startedAfter?: string
  readonly startedBefore?: string
  readonly cursorStartedAt?: string
  readonly cursorId?: string
  readonly limit: number
}

export const listRunsSql = (projectId: string, filter: ListRunsFilter) => {
  const search = filter.search?.trim()
  const like =
    search && search.length > 0 ? `%${search.replaceAll("%", "")}%` : null
  return sql`
  ${projectRunSummaries(projectId, filter)}
  SELECT
    id,
    "externalId",
    workflow,
    "startedAt"::text AS "startedAt",
    status,
    "durationMs",
    step,
    result,
    outcome,
    "correlationId",
    "parentRunId",
    environment,
    release,
    "failCode"
  FROM runs
  WHERE
    (${filter.workflow ?? null}::text IS NULL OR workflow = ${filter.workflow ?? null})
    AND (${filter.status ?? null}::text IS NULL OR status = ${filter.status ?? null})
    AND (${filter.externalId ?? null}::text IS NULL OR "externalId" = ${filter.externalId ?? null})
    AND (${filter.failCode ?? null}::text IS NULL OR "failCode" = ${filter.failCode ?? null})
    AND (${filter.environment ?? null}::text IS NULL OR environment = ${filter.environment ?? null})
    AND (${filter.release ?? null}::text IS NULL OR release = ${filter.release ?? null})
    AND (${filter.correlationId ?? null}::text IS NULL OR "correlationId" = ${filter.correlationId ?? null})
    AND (${filter.parentRunId ?? null}::text IS NULL OR "parentRunId" = ${filter.parentRunId ?? null})
    AND (
      ${filter.namespace ?? null}::text IS NULL
      OR (
        ${filter.namespace ?? null} = 'browser'
        AND workflow LIKE 'browser.%'
      )
      OR (
        ${filter.namespace ?? null} = 'application'
        AND workflow NOT LIKE 'browser.%'
      )
    )
    AND (${filter.startedAfter ?? null}::timestamptz IS NULL OR "startedAt" >= ${filter.startedAfter ?? null}::timestamptz)
    AND (${filter.startedBefore ?? null}::timestamptz IS NULL OR "startedAt" <= ${filter.startedBefore ?? null}::timestamptz)
    AND (
      ${like}::text IS NULL
      OR "externalId" ILIKE ${like}
      OR workflow ILIKE ${like}
      OR coalesce("correlationId", '') ILIKE ${like}
      OR coalesce("parentRunId", '') ILIKE ${like}
      OR coalesce(step, '') ILIKE ${like}
      OR coalesce("failCode", '') ILIKE ${like}
    )
    AND (
      ${filter.cursorStartedAt ?? null}::timestamptz IS NULL
      OR ${filter.cursorId ?? null}::uuid IS NULL
      OR ("startedAt", id) < (${filter.cursorStartedAt ?? null}::timestamptz, ${filter.cursorId ?? null}::uuid)
    )
  ORDER BY "startedAt" DESC, id DESC
  LIMIT ${filter.limit + 1}
`
}

export const listRunsCountSql = (
  projectId: string,
  filter: Omit<ListRunsFilter, "limit" | "cursorStartedAt" | "cursorId">,
) => {
  const search = filter.search?.trim()
  const like =
    search && search.length > 0 ? `%${search.replaceAll("%", "")}%` : null
  return sql`
  ${projectRunSummaries(projectId, filter)}
  SELECT count(*)::int AS count
  FROM runs
  WHERE
    (${filter.workflow ?? null}::text IS NULL OR workflow = ${filter.workflow ?? null})
    AND (${filter.status ?? null}::text IS NULL OR status = ${filter.status ?? null})
    AND (${filter.externalId ?? null}::text IS NULL OR "externalId" = ${filter.externalId ?? null})
    AND (${filter.failCode ?? null}::text IS NULL OR "failCode" = ${filter.failCode ?? null})
    AND (${filter.environment ?? null}::text IS NULL OR environment = ${filter.environment ?? null})
    AND (${filter.release ?? null}::text IS NULL OR release = ${filter.release ?? null})
    AND (${filter.correlationId ?? null}::text IS NULL OR "correlationId" = ${filter.correlationId ?? null})
    AND (${filter.parentRunId ?? null}::text IS NULL OR "parentRunId" = ${filter.parentRunId ?? null})
    AND (
      ${filter.namespace ?? null}::text IS NULL
      OR (
        ${filter.namespace ?? null} = 'browser'
        AND workflow LIKE 'browser.%'
      )
      OR (
        ${filter.namespace ?? null} = 'application'
        AND workflow NOT LIKE 'browser.%'
      )
    )
    AND (${filter.startedAfter ?? null}::timestamptz IS NULL OR "startedAt" >= ${filter.startedAfter ?? null}::timestamptz)
    AND (${filter.startedBefore ?? null}::timestamptz IS NULL OR "startedAt" <= ${filter.startedBefore ?? null}::timestamptz)
    AND (
      ${like}::text IS NULL
      OR "externalId" ILIKE ${like}
      OR workflow ILIKE ${like}
      OR coalesce("correlationId", '') ILIKE ${like}
      OR coalesce("parentRunId", '') ILIKE ${like}
      OR coalesce(step, '') ILIKE ${like}
      OR coalesce("failCode", '') ILIKE ${like}
    )
`
}
