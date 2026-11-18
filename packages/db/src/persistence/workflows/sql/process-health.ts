import { sql } from "drizzle-orm"
import {
  PROCESS_HEALTH_LIMITS as bounds,
  type ProcessHealthQuery,
} from "@flowmarkdev/core"
import {
  expectationStateSql,
  validExpectationProjectionSql,
} from "./expectations.js"
import {
  rawRunRevision,
  rawRunRevisionValue,
  rawRunStatus,
} from "./run-fact-fields.js"

export const processHealthSql = (
  projectId: string,
  query: ProcessHealthQuery,
  observedAt: string,
  offset: number,
  limit: number,
  priorFingerprint: string | undefined,
) => {
  const window = (period: string, selection: ProcessHealthQuery["window"]) =>
    sql`SELECT ${period}::text, ${selection.startedAfter}::timestamptz, ${selection.startedBefore}::timestamptz`

  return sql`
  WITH scope AS MATERIALIZED (
    SELECT id FROM workflows WHERE project_id = ${projectId}::uuid AND name = ${query.workflow}
  ), windows(period, start_at, end_at) AS (
    ${window("current", query.window)}
    ${query.baseline ? sql`UNION ALL ${window("baseline", query.baseline)}` : sql``}
  ), selected_runs AS MATERIALIZED (
    SELECT r.id, r.outcome, w.period
    FROM scope s CROSS JOIN windows w
    CROSS JOIN LATERAL (
      SELECT id, outcome FROM workflow_runs
      WHERE workflow_id = s.id AND started_at >= w.start_at AND started_at < w.end_at
      LIMIT ${bounds.runs + 1}
    ) r
    LIMIT ${bounds.runs + 1}
  ), run_facts AS MATERIALIZED (
    SELECT r.*, f.run_id AS fact_id, f.status, f.definition_revision
    FROM selected_runs r
    LEFT JOIN LATERAL (
      SELECT run_id, status, definition_revision FROM workflow_run_facts
      WHERE run_id = r.id AND version = 1 LIMIT 1
    ) f ON true
    WHERE (SELECT count(*) FROM selected_runs) <= ${bounds.runs}
  ), fallback_events AS MATERIALIZED (
    SELECT e.*, r.id AS run_id
    FROM run_facts r
    CROSS JOIN LATERAL (
      SELECT e.id, e.type, CASE WHEN e.type = 'started' THEN ${rawRunRevisionValue} END AS revision, e.created_at
      FROM workflow_events e WHERE e.run_id = r.id LIMIT ${bounds.fallbackEvents + 1}
    ) e
    WHERE r.fact_id IS NULL
    LIMIT ${bounds.fallbackEvents + 1}
  ), projections AS MATERIALIZED (
    SELECT x.*, r.period
    FROM run_facts r
    CROSS JOIN LATERAL (
      SELECT * FROM workflow_expectations WHERE run_id = r.id LIMIT ${bounds.expectationProjections + 1}
    ) x
    LIMIT ${bounds.expectationProjections + 1}
  ), budget AS (
    SELECT CASE
      WHEN (SELECT count(*) FROM selected_runs) > ${bounds.runs} THEN 'runs'
      WHEN (SELECT count(*) FROM fallback_events) > ${bounds.fallbackEvents} THEN 'fallback-events'
      WHEN (SELECT count(*) FROM projections) > ${bounds.expectationProjections} THEN 'expectation-projections'
    END AS exceeded
  ), raw_facts AS (
    SELECT run_id, ${rawRunStatus} AS status, ${rawRunRevision(sql`e.revision`)} AS revision
    FROM fallback_events e WHERE (SELECT exceeded IS NULL FROM budget) GROUP BY run_id
  ), runs AS MATERIALIZED (
    SELECT r.id, r.period, r.outcome, coalesce(r.status, f.status, 'Running') AS status,
      coalesce(r.definition_revision, f.revision) AS revision
    FROM run_facts r LEFT JOIN raw_facts f ON f.run_id = r.id
    WHERE (SELECT exceeded IS NULL FROM budget)
  ), effective AS (
    SELECT x.id, x.run_id, x.period, x.expectation_id, x.deadline_at,
      d.expectation ->> 'name' AS name,
      x.declaration_event_id IS NULL AND ${validExpectationProjectionSql} AS settlement_only,
      ${expectationStateSql(observedAt)} AS state
    FROM projections x
    LEFT JOIN LATERAL (
      SELECT expectation FROM workflow_events WHERE id = x.declaration_event_id LIMIT 1
    ) d ON true
    WHERE (SELECT exceeded IS NULL FROM budget)
  ), classified AS MATERIALIZED (
    SELECT id, run_id, period, expectation_id, deadline_at,
      CASE
        WHEN settlement_only THEN 'settlement-only'
        WHEN state IS NULL THEN 'unavailable'
        WHEN name IS DISTINCT FROM ${query.expectationName} THEN 'other'
        ELSE state
      END AS state,
      deadline_at < ${observedAt}::timestamptz
        AND state IN ('overdue', 'met-on-time', 'met-late')
        AND name = ${query.expectationName} AS mature
    FROM effective
  ), declared_runs AS (
    SELECT DISTINCT run_id FROM classified
    WHERE state NOT IN ('settlement-only', 'unavailable', 'other')
  ), outcome_counts AS (
    SELECT period, outcome, count(*)::int AS runs FROM runs
    WHERE outcome IS NOT NULL GROUP BY period, outcome
  ), assessments AS (
    SELECT w.period, jsonb_build_object(
      'execution', (
        SELECT jsonb_build_object(
          'completed', count(*) FILTER (WHERE r.status = 'Completed'),
          'failed', count(*) FILTER (WHERE r.status = 'Failed'),
          'withoutTerminal', count(*) FILTER (WHERE r.status = 'Running')
        ) FROM runs r WHERE r.period = w.period
      ),
      'businessOutcomes', jsonb_build_object(
        'reported', (SELECT coalesce(jsonb_agg(jsonb_build_object('outcome', outcome, 'runs', runs) ORDER BY outcome), '[]') FROM outcome_counts o WHERE o.period = w.period),
        'missing', (SELECT count(*) FROM runs r WHERE r.period = w.period AND r.outcome IS NULL)
      ),
      'evidenceQuality', jsonb_build_object(
        'revisions', (SELECT coalesce(jsonb_agg(DISTINCT revision ORDER BY revision), '[]') FROM runs r WHERE r.period = w.period),
        'runsWithoutDeclaration', (SELECT count(*) FROM runs r LEFT JOIN declared_runs d ON d.run_id = r.id WHERE r.period = w.period AND d.run_id IS NULL),
        'unavailableProjections', (SELECT count(*) FROM classified x WHERE x.period = w.period AND state = 'unavailable'),
        'settlementsWithoutDeclaration', (SELECT count(*) FROM classified x WHERE x.period = w.period AND state = 'settlement-only'),
        'otherExpectationDeclarations', (SELECT count(*) FROM classified x WHERE x.period = w.period AND state = 'other'),
        'intendedCoverage', 'unknown'
      ),
      'expectations', (
        SELECT jsonb_build_object(
          'mature', count(*) FILTER (WHERE mature),
          'overdue', count(*) FILTER (WHERE mature AND state = 'overdue'),
          'metOnTime', count(*) FILTER (WHERE mature AND state = 'met-on-time'),
          'metLate', count(*) FILTER (WHERE mature AND state = 'met-late'),
          'immature', count(*) FILTER (WHERE NOT mature AND state IN ('pending', 'met-on-time', 'met-late')),
          'pending', count(*) FILTER (WHERE state = 'pending'),
          'cancelled', count(*) FILTER (WHERE state = 'cancelled')
        ) FROM classified x WHERE x.period = w.period
      )
    ) AS assessment FROM windows w
  ), fingerprint AS (
    SELECT encode(sha256(convert_to(jsonb_build_array(
      (SELECT jsonb_agg(to_jsonb(r) ORDER BY id) FROM runs r),
      (SELECT jsonb_agg(to_jsonb(x) ORDER BY id) FROM classified x)
    )::text, 'UTF8')), 'hex') AS value
  ), page AS (
    SELECT jsonb_build_object(
      'runId', run_id, 'expectationId', expectation_id, 'state', state,
      'deadlineAt', to_char(deadline_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
    ) AS record, id
    FROM classified WHERE period = 'current' AND mature
      AND (${query.evidence === "mature"} OR state = 'overdue')
    ORDER BY id
    LIMIT ${limit}
    OFFSET (SELECT CASE WHEN value = ${priorFingerprint ?? null} THEN ${offset} ELSE 0 END FROM fingerprint)
  )
  SELECT EXISTS(SELECT 1 FROM scope) AS supported, budget.exceeded, fingerprint.value AS fingerprint,
    (SELECT assessment FROM assessments WHERE period = 'current') AS current,
    (SELECT assessment FROM assessments WHERE period = 'baseline') AS baseline,
    (SELECT coalesce(jsonb_agg(record ORDER BY id), '[]') FROM page) AS records
  FROM budget CROSS JOIN fingerprint
  `
}
