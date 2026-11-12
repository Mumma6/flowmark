import { sql } from "drizzle-orm"
import { Array } from "effect"
import {
  LINKED_COMPARISON_BOUNDS,
  LINKED_COVERAGE,
  type LinkedComparisonQuery,
} from "@flowmarkdev/core"
import { projectRunSummaries } from "./run-summaries.js"
import { resultValue, validCount } from "./result-filters.js"

const timestamp = (expression: ReturnType<typeof sql>) =>
  sql`to_char(${expression} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`

/** Bounded roots and at most two link/identity candidates per anchor. */
export const linkedPairsSql = (
  projectId: string,
  query: LinkedComparisonQuery,
) => sql`
  WITH scopes(scope, after, before, target_release) AS (VALUES
    ('current', ${query.currentStartedAfter}::timestamptz, ${query.currentStartedBefore}::timestamptz, ${query.releaseB ?? null}::text),
    ('previous', ${query.previousStartedAfter}::timestamptz, ${query.previousStartedBefore}::timestamptz, ${query.releaseA ?? null}::text)
  ), anchors AS (
    SELECT scopes.*, a.* FROM scopes CROSS JOIN LATERAL (
      SELECT r.id, r.external_id, r.started_at
      FROM workflow_runs r JOIN workflows w ON w.id = r.workflow_id
      WHERE w.project_id = ${projectId}::uuid AND w.name = ${query.upstreamWorkflow}
        AND r.started_at >= scopes.after AND r.started_at < scopes.before
        AND (${query.businessKey ?? null}::text IS NULL OR (
          jsonb_typeof(r.properties -> ${query.businessKey ?? null}::text) = 'string'
          AND r.properties @> jsonb_build_object(${query.businessKey ?? ""}::text, ${query.businessValue ?? null}::text)
        ))
      ORDER BY r.started_at, r.id LIMIT ${LINKED_COMPARISON_BOUNDS.maximumAnchorsPerWindow + 1}
    ) a
  ), pairs AS (
    SELECT a.*, identity.matches AS parent_matches, children.matches AS child_matches,
      CASE WHEN identity.matches = 1 AND children.matches = 1 THEN children.id ELSE NULL END AS child_id
    FROM anchors a
    CROSS JOIN LATERAL (
      SELECT count(*)::int AS matches FROM (
        SELECT p.id FROM workflow_runs p JOIN workflows pw ON pw.id = p.workflow_id
        WHERE pw.project_id = ${projectId}::uuid AND p.external_id = a.external_id LIMIT 2
      ) candidates
    ) identity
    CROSS JOIN LATERAL (
      SELECT count(*)::int AS matches, min(id::text)::uuid AS id FROM (
        SELECT c.id FROM workflow_runs c JOIN workflows cw ON cw.id = c.workflow_id
        WHERE cw.project_id = ${projectId}::uuid AND cw.name = ${query.downstreamWorkflow}
          AND c.parent_run_id = a.external_id LIMIT 2
      ) candidates
    ) children
  )
`

export const linkedReadBudgetSql = (
  projectId: string,
  query: LinkedComparisonQuery,
) => sql`
  ${linkedPairsSql(projectId, query)}, selected_runs AS (
    SELECT id FROM pairs UNION SELECT child_id FROM pairs WHERE child_id IS NOT NULL
  )
  SELECT
    coalesce((SELECT max(total)::int FROM (SELECT count(*) AS total FROM anchors GROUP BY scope) counts), 0) AS "maximumAnchors",
    (SELECT count(*)::int FROM (
      SELECT e.id FROM selected_runs selected
      JOIN workflow_events e ON e.run_id = selected.id
      LEFT JOIN workflow_run_facts facts ON facts.run_id = selected.id AND facts.version = 1
      WHERE facts.run_id IS NULL LIMIT ${LINKED_COMPARISON_BOUNDS.maximumFallbackEvents + 1}
    ) fallback) AS "fallbackEvents"
`

/** One classification shared by aggregate and every evidence page. */
export const linkedClassifiedSql = (
  projectId: string,
  query: LinkedComparisonQuery,
) => {
  const numerator = resultValue(query.numerator, sql`downstream.result`)
  const denominator = resultValue(query.denominator, sql`downstream.result`)
  return sql`${linkedPairsSql(projectId, query)}, observed AS (
    SELECT p.*, upstream."definitionRevision" AS upstream_revision,
      downstream.status AS downstream_status, downstream."definitionRevision" AS downstream_revision,
      downstream.release AS downstream_release, downstream."externalId" AS downstream_external_id,
      downstream."startedAt" AS downstream_started_at, downstream.result IS NULL AS missing_result,
      ${numerator} AS numerator_value, ${denominator} AS denominator_value
    FROM pairs p
    LEFT JOIN LATERAL (
      ${projectRunSummaries(projectId, { runId: sql`p.id` })}
      SELECT "definitionRevision" FROM runs
    ) upstream ON true
    LEFT JOIN LATERAL (
      ${projectRunSummaries(projectId, { runId: sql`p.child_id` })}
      SELECT status, "definitionRevision", release, "externalId", "startedAt", result FROM runs
      WHERE p.child_id IS NOT NULL
    ) downstream ON true
  ), classified AS MATERIALIZED (
    SELECT scope, id, external_id, started_at, child_id, downstream_status, downstream_revision,
      downstream_release, downstream_external_id, downstream_started_at,
      CASE
        WHEN upstream_revision IS DISTINCT FROM ${query.upstreamRevision} THEN 'upstreamRevision'
        WHEN parent_matches <> 1 THEN 'ambiguousParent'
        WHEN child_matches = 0 THEN 'missingLink'
        WHEN child_matches > 1 THEN 'multipleLinks'
        WHEN target_release IS NOT NULL AND downstream_release IS DISTINCT FROM target_release THEN 'releaseMismatch'
        WHEN downstream_revision IS DISTINCT FROM ${query.downstreamRevision} THEN 'downstreamRevision'
        WHEN downstream_status = 'Running' THEN 'unfinished'
        WHEN missing_result THEN 'missingResult'
        WHEN numerator_value IS NULL OR denominator_value IS NULL THEN 'missingMetric'
        WHEN NOT (${validCount(sql`numerator_value`)}) OR NOT (${validCount(sql`denominator_value`)}) THEN 'invalidMetric'
        ELSE 'known' END AS coverage,
      CASE WHEN ${validCount(sql`numerator_value`)} THEN trunc((numerator_value::text)::numeric) ELSE NULL END AS numerator,
      CASE WHEN ${validCount(sql`denominator_value`)} THEN trunc((denominator_value::text)::numeric) ELSE NULL END AS denominator
    FROM observed
  )`
}

export const linkedAggregateSql = (
  projectId: string,
  query: LinkedComparisonQuery,
) => sql`
  ${linkedClassifiedSql(projectId, query)}
  SELECT jsonb_build_object(
    'scope', scopes.scope, 'anchors', count(c.id),
    'knownPairs', count(c.id) FILTER (WHERE coverage = 'known'),
    'failedKnownPairs', count(c.id) FILTER (WHERE coverage = 'known' AND downstream_status = 'Failed'),
    'coverage', jsonb_build_object(${sql.join(
      Array.flatMap(LINKED_COVERAGE, (coverage) => [
        sql`${coverage}::text`,
        sql`count(c.id) FILTER (WHERE coverage = ${coverage})`,
      ]),
      sql`, `,
    )}),
    'numerator', trunc(sum(numerator) FILTER (WHERE coverage = 'known'))::text,
    'denominator', trunc(sum(denominator) FILTER (WHERE coverage = 'known'))::text,
    'ratio', (sum(numerator) FILTER (WHERE coverage = 'known') / nullif(sum(denominator) FILTER (WHERE coverage = 'known'), 0))::float8
  ) AS data
  FROM scopes LEFT JOIN classified c ON c.scope = scopes.scope
  GROUP BY scopes.scope ORDER BY scopes.scope
`

export const linkedEvidenceSql = (
  projectId: string,
  query: LinkedComparisonQuery,
  selection: {
    readonly scope: string
    readonly coverage?: string
    readonly limit: number
    readonly after?: { readonly startedAt: string; readonly id: string }
  },
) => sql`
  ${linkedClassifiedSql(projectId, query)}, eligible AS (
    SELECT * FROM classified WHERE scope = ${selection.scope}
      AND (${selection.coverage ?? null}::text IS NULL OR coverage = ${selection.coverage ?? null})
  ), visible AS (
    SELECT *, ${timestamp(sql`started_at`)} AS cursor_time FROM eligible
    WHERE (${selection.after?.id ?? null}::uuid IS NULL OR (started_at, id) > (${selection.after?.startedAt ?? null}::timestamptz, ${selection.after?.id ?? null}::uuid))
    ORDER BY started_at, id LIMIT ${selection.limit + 1}
  )
  SELECT (SELECT count(*)::int FROM eligible) AS total,
    (${selection.after?.id ?? null}::uuid IS NULL OR EXISTS (
      SELECT 1 FROM eligible WHERE id = ${selection.after?.id ?? null}::uuid
        AND started_at = ${selection.after?.startedAt ?? null}::timestamptz
    )) AS "cursorValid",
    coalesce((SELECT jsonb_agg(jsonb_build_object(
      'anchor', jsonb_build_object('id', id, 'externalId', external_id, 'workflow', ${query.upstreamWorkflow}::text, 'startedAt', cursor_time),
      'downstream', CASE WHEN child_id IS NOT NULL THEN jsonb_build_object(
        'id', child_id, 'externalId', downstream_external_id, 'workflow', ${query.downstreamWorkflow}::text,
        'startedAt', ${timestamp(sql`downstream_started_at`)}, 'status', downstream_status, 'release', downstream_release, 'revision', downstream_revision
      ) ELSE NULL END,
      'coverage', coverage,
      'numerator', CASE WHEN coverage = 'known' THEN numerator::text ELSE NULL END,
      'denominator', CASE WHEN coverage = 'known' THEN denominator::text ELSE NULL END
    ) ORDER BY started_at, id) FROM visible), '[]'::jsonb) AS rows
`
