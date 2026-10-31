import type {
  RatioSelection,
  ResultDeclaration,
  ResultSelection,
} from "@flowmarkdev/core"
import { resultPredicate } from "./result-filters.js"
import { sql } from "drizzle-orm"

type BusinessFilter = {
  runId?: string
  workflow?: string
  businessKey?: string
  businessValue?: string
  dimensionOnly?: boolean
  startedAfter?: string
  startedBeforeExclusive?: string
  intervals?: readonly { after: string; before: string }[]
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
    AND ((field ->> 'role' = 'lookup' AND ${filter.dimensionOnly !== true}) OR (field ->> 'role' = 'dimension' AND (field -> 'values') ? ${filter.businessValue ?? ""}))
  )
`
/**
 * One row per project run, with last-reported terminal status.
 * First terminal wins for new writes; historical mixed terminals retain Failed.
 * Missing terminal events stay Running.
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
      (array_agg(CASE WHEN jsonb_typeof(e.properties -> 'definitionRevision') = 'string' THEN e.properties ->> 'definitionRevision' END ORDER BY e.created_at, e.id)
        FILTER (WHERE e.type = 'started'))[1] AS "definitionRevision",
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
      AND (${business?.runId ?? null}::uuid IS NULL OR r.id = ${business?.runId ?? null}::uuid)
      AND (${business?.workflow ?? null}::text IS NULL OR w.name = ${business?.workflow ?? null})
      AND (${business?.startedAfter ?? null}::timestamptz IS NULL OR r.started_at >= ${business?.startedAfter ?? null}::timestamptz)
      AND (${business?.startedBeforeExclusive ?? null}::timestamptz IS NULL OR r.started_at < ${business?.startedBeforeExclusive ?? null}::timestamptz)
      AND (${
        business?.intervals
          ? sql.join(
              business.intervals.map(
                (interval) =>
                  sql`(r.started_at >= ${interval.after}::timestamptz AND r.started_at < ${interval.before}::timestamptz)`,
              ),
              sql` OR `,
            )
          : sql`true`
      })
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
  ${projectRunSummaries(projectId, { runId })}
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

export const peerRunsSql = (
  projectId: string,
  runId: string,
  selection: import("@flowmarkdev/core").PeerSelection = {},
) => sql`
  WITH current_run AS (
    SELECT r.id, r.workflow_id, r.started_at, r.environment, r.release FROM workflow_runs r
    JOIN workflows w ON w.id = r.workflow_id WHERE w.project_id = ${projectId} AND r.id = ${runId}
  ), eligible AS (
    SELECT r.id FROM workflow_runs r JOIN current_run c ON c.workflow_id = r.workflow_id
    WHERE (r.started_at, r.id) < (c.started_at, c.id)
      AND r.started_at >= c.started_at - (${selection.days ?? 30} * interval '24 hours')
      AND (${selection.environment === "all"} OR r.environment IS NOT DISTINCT FROM c.environment)
      AND (${selection.sameRelease ?? false} = false OR r.release IS NOT DISTINCT FROM c.release)
      AND (${selection.dimensionKey ?? null}::text IS NULL OR (
        jsonb_typeof(r.properties -> ${selection.dimensionKey ?? ""}) = 'string'
        AND r.properties ->> ${selection.dimensionKey ?? ""} = ${selection.dimensionValue ?? ""}
        AND EXISTS (SELECT 1 FROM workflow_search_fields config, jsonb_array_elements(config.fields) field
          WHERE config.project_id = ${projectId} AND config.workflow = (SELECT name FROM workflows WHERE id = c.workflow_id)
          AND field ->> 'role' = 'dimension' AND field ->> 'key' = ${selection.dimensionKey ?? ""}
          AND (field -> 'values') ? ${selection.dimensionValue ?? ""})
      ))
  )
  SELECT r.id, count(*) OVER ()::int AS eligible,
    c.environment, c.release
  FROM eligible e JOIN workflow_runs r ON r.id = e.id CROSS JOIN current_run c
  ORDER BY r.started_at DESC, r.id DESC LIMIT 50
`

export type ListRunsFilter = {
  readonly ratioSelection?: RatioSelection
  readonly resultField?: ResultDeclaration["fields"][number]
  readonly resultSelection?: ResultSelection
  readonly outcome?: string
  readonly definitionRevision?: string
  readonly terminalOnly?: boolean
  readonly startedBeforeExclusive?: string
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
    ${resultPredicate(filter.resultSelection, filter.resultField)}
    AND ${filter.ratioSelection ? sql`${resultPredicate({ revision: filter.ratioSelection.revision, path: filter.ratioSelection.numerator, operator: "gte", value: 0 })} AND ${resultPredicate({ revision: filter.ratioSelection.revision, path: filter.ratioSelection.denominator, operator: "gte", value: 0 })}` : sql`true`}
    AND (${filter.outcome ?? null}::text IS NULL OR outcome = ${filter.outcome ?? null})
    AND (${filter.definitionRevision ?? null}::text IS NULL OR "definitionRevision" = ${filter.definitionRevision ?? null})
    AND (${filter.terminalOnly ?? false} = false OR status <> 'Running')
    AND (${filter.startedBeforeExclusive ?? null}::timestamptz IS NULL OR "startedAt" < ${filter.startedBeforeExclusive ?? null}::timestamptz)
    AND (${filter.workflow ?? null}::text IS NULL OR workflow = ${filter.workflow ?? null})
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
    ${resultPredicate(filter.resultSelection, filter.resultField)}
    AND ${filter.ratioSelection ? sql`${resultPredicate({ revision: filter.ratioSelection.revision, path: filter.ratioSelection.numerator, operator: "gte", value: 0 })} AND ${resultPredicate({ revision: filter.ratioSelection.revision, path: filter.ratioSelection.denominator, operator: "gte", value: 0 })}` : sql`true`}
    AND (${filter.outcome ?? null}::text IS NULL OR outcome = ${filter.outcome ?? null})
    AND (${filter.definitionRevision ?? null}::text IS NULL OR "definitionRevision" = ${filter.definitionRevision ?? null})
    AND (${filter.terminalOnly ?? false} = false OR status <> 'Running')
    AND (${filter.startedBeforeExclusive ?? null}::timestamptz IS NULL OR "startedAt" < ${filter.startedBeforeExclusive ?? null}::timestamptz)
    AND (${filter.workflow ?? null}::text IS NULL OR workflow = ${filter.workflow ?? null})
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
