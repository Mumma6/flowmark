import { sql } from "drizzle-orm"
import type { ExpectationState } from "@flowmarkdev/core"

/** Alias x is always a project-scoped expectation projection correlated with runs.id. */
export const expectationStateSql = (asOf: string) => sql`CASE
  WHEN NOT ${validExpectationProjectionSql} OR x.declared_at IS NULL THEN NULL
  WHEN x.settlement_type = 'expectation_cancelled' THEN 'cancelled'
  WHEN x.settlement_type = 'expectation_resolved' THEN
    CASE WHEN x.settled_at <= x.deadline_at THEN 'met-on-time' ELSE 'met-late' END
  WHEN x.deadline_at < ${asOf}::timestamptz THEN 'overdue' ELSE 'pending' END`
export const expectationMatchSql = (
  state: ExpectationState | undefined,
  asOf: string,
) =>
  state === undefined
    ? sql`true`
    : sql`EXISTS (
  SELECT 1 FROM workflow_expectations x WHERE x.run_id = runs.id AND ${expectationStateSql(asOf)} = ${state}
)`

/** A projection is not an archive: missing/expired canonical evidence invalidates its state. */
export const validExpectationProjectionSql = sql`(
  (x.declaration_event_id IS NOT NULL OR x.settlement_event_id IS NOT NULL) AND
  (x.declaration_event_id IS NULL OR EXISTS (SELECT 1 FROM workflow_events d
    WHERE d.id = x.declaration_event_id AND d.run_id = x.run_id AND d.expectation_effective = true AND d.expectation_owner_id = x.id AND d.expectation->>'type' = 'expectation_declared'
      AND d.expectation->>'expectationId' = x.expectation_id AND d.expectation_observed_at = x.declared_at))
  AND (x.settlement_event_id IS NULL OR EXISTS (SELECT 1 FROM workflow_events s
    WHERE s.id = x.settlement_event_id AND s.run_id = x.run_id AND s.expectation_effective = true AND s.expectation_owner_id = x.id AND s.expectation->>'type' = x.settlement_type
      AND s.expectation->>'expectationId' = x.expectation_id AND s.expectation_observed_at = x.settled_at))
)`
