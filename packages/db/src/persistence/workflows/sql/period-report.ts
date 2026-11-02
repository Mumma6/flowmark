import { sql } from "drizzle-orm"
import { projectRunSummaries } from "./run-summaries.js"

type Window = {
  readonly startedAfter: string
  readonly startedBefore: string
}

const intervals = (current: Window, previous: Window) => [
  { after: current.startedAfter, before: current.startedBefore },
  { after: previous.startedAfter, before: previous.startedBefore },
]

const periodCase = (current: Window) => sql`
  CASE
    WHEN "startedAt" >= ${current.startedAfter}::timestamptz
      AND "startedAt" < ${current.startedBefore}::timestamptz
      THEN 'current'
    ELSE 'previous'
  END
`

/**
 * Runs started in either half-open window. One row per run.
 * A run that could match both windows is counted in the current window.
 */
export const workflowPeriodSql = (
  projectId: string,
  workflow: string | undefined,
  current: Window,
  previous: Window,
) => sql`
  ${projectRunSummaries(projectId, {
    ...(workflow ? { workflow } : {}),
    intervals: intervals(current, previous),
  })}
  , labeled AS (
    SELECT
      workflow AS name,
      ${periodCase(current)} AS period,
      status,
      "durationMs"
    FROM runs
  )
  , periods AS (
    SELECT
      name,
      period,
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
    FROM labeled
    GROUP BY name, period
  )
  SELECT *
  FROM periods
  WHERE name IN (
    SELECT name
    FROM periods
    GROUP BY name
    ORDER BY sum("totalRuns") DESC, name
    LIMIT 100
  )
`

export const periodWorkflowNamesSql = (
  projectId: string,
  current: Window,
  previous: Window,
) => sql`
  ${projectRunSummaries(projectId, {
    intervals: intervals(current, previous),
  })}
  SELECT workflow AS name
  FROM runs
  GROUP BY workflow
  ORDER BY count(*) DESC, workflow
  LIMIT 100
`

/** UTC start days in the current window. Days with no starts are zero. */
export const periodDailySql = (
  projectId: string,
  workflow: string | undefined,
  current: Window,
) => sql`
  ${projectRunSummaries(projectId, {
    ...(workflow ? { workflow } : {}),
    startedAfter: current.startedAfter,
    startedBeforeExclusive: current.startedBefore,
  })}
  SELECT
    to_char(day, 'YYYY-MM-DD') AS date,
    count(runs.id)::int AS count,
    count(runs.id) FILTER (WHERE status = 'Completed')::int AS completed,
    count(runs.id) FILTER (WHERE status = 'Failed')::int AS failed,
    round(
      100.0 * count(runs.id) FILTER (WHERE status = 'Completed')
      / nullif(count(runs.id) FILTER (WHERE status <> 'Running'), 0),
      1
    )::float8 AS "successRate",
    percentile_cont(0.5) WITHIN GROUP (ORDER BY "durationMs")
      FILTER (WHERE "durationMs" IS NOT NULL)::float8 AS "medianDurationMs",
    percentile_cont(0.95) WITHIN GROUP (ORDER BY "durationMs")
      FILTER (WHERE "durationMs" IS NOT NULL)::float8 AS "p95DurationMs"
  FROM generate_series(
    (${current.startedAfter}::timestamptz AT TIME ZONE 'UTC')::date,
    ((${current.startedBefore}::timestamptz - interval '1 millisecond') AT TIME ZONE 'UTC')::date,
    interval '1 day'
  ) day
  LEFT JOIN runs ON ("startedAt" AT TIME ZONE 'UTC')::date = day::date
  GROUP BY day
  ORDER BY day
`

/**
 * One group is a workflow plus a terminal failure code.
 * An empty code means the failed run recorded no code.
 * Only groups with a failure in the current window are returned.
 */
export const failureGroupsSql = (
  projectId: string,
  workflow: string | undefined,
  current: Window,
  previous: Window,
) => sql`
  ${projectRunSummaries(projectId, {
    ...(workflow ? { workflow } : {}),
    intervals: intervals(current, previous),
  })}
  , failed AS (
    SELECT
      workflow,
      coalesce("failCode", '') AS code,
      id,
      "startedAt",
      ${periodCase(current)} AS period
    FROM runs
    WHERE status = 'Failed'
  )
  SELECT
    workflow,
    code,
    count(*) FILTER (WHERE period = 'current')::int AS "currentCount",
    count(*) FILTER (WHERE period = 'previous')::int AS "previousCount",
    max("startedAt") FILTER (WHERE period = 'current')::text AS "lastStartedAt",
    (array_agg(id::text ORDER BY "startedAt" DESC) FILTER (WHERE period = 'current'))[1:5]
      AS "runIds"
  FROM failed
  GROUP BY workflow, code
  HAVING count(*) FILTER (WHERE period = 'current') > 0
  ORDER BY count(*) FILTER (WHERE period = 'current') DESC, workflow, code
  LIMIT 51
`
