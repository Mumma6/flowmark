import { sql } from "drizzle-orm"
import type {
  BusinessInsightsQuery,
  ResultDeclaration,
} from "@flowmarkdev/core"
import { projectRunSummaries } from "./run-summaries.js"
import { resultValue, validCount } from "./result-filters.js"

export const businessInsightsSql = (
  projectId: string,
  query: BusinessInsightsQuery,
  field: ResultDeclaration["fields"][number],
) => {
  const first = new Date(
    Math.min(
      Date.parse(query.currentStartedAfter),
      Date.parse(query.previousStartedAfter),
    ),
  ).toISOString()
  const last = new Date(
    Math.max(
      Date.parse(query.currentStartedBefore),
      Date.parse(query.previousStartedBefore),
    ),
  ).toISOString()
  const value = resultValue(query.path)
  const numerator = resultValue(query.numerator ?? [])
  const denominator = resultValue(query.denominator ?? [])
  const values = JSON.stringify(field.values ?? [])
  const object = sql`CASE WHEN jsonb_typeof(value) = 'object' THEN value ELSE '{}'::jsonb END`
  const amount = sql`CASE WHEN ${field.kind} = 'count' AND ${validCount(sql`value`)} THEN (value::text)::numeric
    WHEN ${field.kind} = 'reasons' THEN (SELECT sum((item.value::text)::numeric) FROM jsonb_each(${object}) item WHERE ${validCount(sql`item.value`)}) ELSE NULL END`
  return sql`
  ${projectRunSummaries(projectId, {
    ...query,
    dimensionOnly: true,
    startedAfter: first,
    startedBeforeExclusive: last,
    intervals: [
      { after: query.currentStartedAfter, before: query.currentStartedBefore },
      {
        after: query.previousStartedAfter,
        before: query.previousStartedBefore,
      },
    ],
  })},
  scope_names AS (
    SELECT 'current'::text AS scope UNION ALL SELECT 'previous'
    UNION ALL SELECT 'releaseA' WHERE ${query.releaseA ?? null}::text IS NOT NULL
    UNION ALL SELECT 'releaseB' WHERE ${query.releaseB ?? null}::text IS NOT NULL
  ), scopes AS (
    SELECT names.scope, r.*, ${value} AS value, ${numerator} AS numerator, ${denominator} AS denominator
    FROM scope_names names JOIN runs r ON
      CASE WHEN names.scope = 'previous' THEN r."startedAt" >= ${query.previousStartedAfter}::timestamptz AND r."startedAt" < ${query.previousStartedBefore}::timestamptz
      ELSE r."startedAt" >= ${query.currentStartedAfter}::timestamptz AND r."startedAt" < ${query.currentStartedBefore}::timestamptz END
    AND CASE names.scope WHEN 'releaseA' THEN r.release = ${query.releaseA ?? null} WHEN 'releaseB' THEN r.release = ${query.releaseB ?? null} ELSE true END
  ), classified AS (
    SELECT *, CASE
      WHEN status = 'Running' THEN 'open'
      WHEN "definitionRevision" IS DISTINCT FROM ${query.revision} THEN 'incompatible'
      WHEN result IS NULL THEN 'missingResult'
      WHEN value IS NULL THEN 'missingField'
      WHEN ${field.kind} = 'count' THEN CASE WHEN ${validCount(sql`value`)} THEN 'known' ELSE 'wrongType' END
      WHEN ${field.kind} = 'category' THEN CASE WHEN jsonb_typeof(value) <> 'string' THEN 'wrongType' WHEN ${values}::jsonb ? (value #>> '{}') THEN 'known' ELSE 'unknownCategory' END
      WHEN jsonb_typeof(value) <> 'object' THEN 'wrongType'
      WHEN EXISTS (SELECT 1 FROM jsonb_each(${object}) item WHERE NOT (${validCount(sql`item.value`)})) THEN 'wrongType'
      WHEN EXISTS (SELECT 1 FROM jsonb_object_keys(${object}) key WHERE NOT (${values}::jsonb ? key)) THEN 'unknownCategory'
      ELSE 'known' END AS coverage,
      status <> 'Running' AND "definitionRevision" = ${query.revision}
        AND ${query.numerator !== undefined} AND ${validCount(sql`numerator`)} AND ${validCount(sql`denominator`)} AS ratio_known
    FROM scopes
  ), measured AS (
    SELECT *, CASE WHEN coverage = 'known' THEN ${amount} ELSE NULL END AS amount
    FROM classified
  )
  SELECT jsonb_build_object(
    'scope', names.scope,
    'totalRuns', count(m.id),
    'finishedRuns', count(m.id) FILTER (WHERE status <> 'Running'),
    'failedRuns', count(m.id) FILTER (WHERE status = 'Failed'),
    'openRuns', count(m.id) FILTER (WHERE status = 'Running'),
    'incompatibleRevision', count(m.id) FILTER (WHERE coverage = 'incompatible'),
    'missingResult', count(m.id) FILTER (WHERE coverage = 'missingResult'),
    'missingField', count(m.id) FILTER (WHERE coverage = 'missingField'),
    'wrongType', count(m.id) FILTER (WHERE coverage = 'wrongType'),
    'unknownCategory', count(m.id) FILTER (WHERE coverage = 'unknownCategory'),
    'knownRuns', count(m.id) FILTER (WHERE coverage = 'known'),
    'total', sum(amount)::text,
    'missingOutcome', count(m.id) FILTER (WHERE status <> 'Running' AND outcome IS NULL),
    'outcomes', coalesce((SELECT jsonb_agg(row) FROM (
      SELECT outcome AS value, count(*)::int AS runs FROM measured e
      WHERE e.scope = names.scope AND status <> 'Running' AND outcome IS NOT NULL GROUP BY outcome ORDER BY count(*) DESC, outcome LIMIT 20
    ) row), '[]'::jsonb),
    'otherOutcomeRuns', coalesce((SELECT sum(runs)::int FROM (
      SELECT count(*) AS runs FROM measured e WHERE e.scope = names.scope AND status <> 'Running' AND outcome IS NOT NULL GROUP BY outcome ORDER BY count(*) DESC, outcome OFFSET 20
    ) omitted), 0),
    'categories', coalesce((SELECT jsonb_agg(row ORDER BY row.value) FROM (
      SELECT category AS value,
        count(e.id) FILTER (WHERE CASE WHEN ${field.kind} = 'category' THEN e.value #>> '{}' = category ELSE e.value ? category END)::int AS runs,
        sum(CASE WHEN ${field.kind} = 'reasons' AND ${validCount(sql`(e.value -> category)`)} THEN ((e.value -> category)::text)::numeric END)::text AS total
      FROM jsonb_array_elements_text(${values}::jsonb) category
      LEFT JOIN measured e ON e.scope = names.scope AND coverage = 'known'
      GROUP BY category
    ) row), '[]'::jsonb),
    'daily', coalesce((SELECT jsonb_agg(row ORDER BY row.date) FROM (
      SELECT to_char(e."startedAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS date,
        count(*) FILTER (WHERE status <> 'Running')::int AS "finishedRuns", count(*) FILTER (WHERE coverage = 'known')::int AS "knownRuns", sum(amount)::text AS total
      FROM measured e WHERE e.scope = names.scope GROUP BY date
    ) row), '[]'::jsonb),
    'ratio', jsonb_build_object(
      'knownRuns', count(m.id) FILTER (WHERE ratio_known),
      'numerator', (sum((numerator::text)::numeric) FILTER (WHERE ratio_known))::text,
      'denominator', (sum((denominator::text)::numeric) FILTER (WHERE ratio_known))::text,
      'value', (sum((numerator::text)::numeric) FILTER (WHERE ratio_known) / nullif(sum((denominator::text)::numeric) FILTER (WHERE ratio_known), 0))::float8
    )
  ) AS data
  FROM scope_names names LEFT JOIN measured m ON m.scope = names.scope
  GROUP BY names.scope ORDER BY names.scope
  `
}
