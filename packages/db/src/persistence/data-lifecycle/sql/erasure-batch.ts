import { sql, type SQL } from "drizzle-orm"
import { Array, Match, Option } from "effect"
import type { LifecycleOperation } from "../types.js"
import { selectedRuns } from "./selection.js"

/** Phase numbers are persisted. Never reorder without migrating unfinished jobs. */
export const EVENT_ERASURE_PHASE = 2
export const RUN_ERASURE_PHASE = 5
const projectChildren = [
  "saved_investigations",
  "workflow_definition_imports",
  "project_api_keys",
  "project_browser_keys",
  "agent_access_grant_projects",
  "workflow_result_declarations",
  "workflow_search_fields",
  "workflows",
] as const

export const finalErasurePhase = (operation: LifecycleOperation) =>
  operation.scope.kind === "project" ? 6 + projectChildren.length : 8

/** Null is the explicit finalization phase, never a failed-query fallback. */
export const erasureBatchSql = (
  operation: LifecycleOperation,
  credentialEpoch: number,
): SQL | null => {
  const { projectId, scope, phase } = operation
  const selection = sql`SELECT r.id FROM workflow_runs r JOIN workflows w ON w.id = r.workflow_id WHERE ${selectedRuns(projectId, scope, operation.createdAt)}`
  const telemetry = [
    sql`UPDATE workflow_events SET expectation_owner_id = NULL WHERE id IN (SELECT id FROM workflow_events WHERE run_id IN (${selection}) AND expectation_owner_id IS NOT NULL LIMIT 1000) RETURNING id`,
    sql`DELETE FROM workflow_expectations WHERE id IN (SELECT id FROM workflow_expectations WHERE run_id IN (${selection}) LIMIT 1000) RETURNING id`,
    sql`DELETE FROM workflow_events WHERE id IN (SELECT id FROM workflow_events WHERE run_id IN (${selection}) LIMIT 1000) RETURNING id`,
    sql`DELETE FROM workflow_metric_facts WHERE event_id IN (SELECT event_id FROM workflow_metric_facts WHERE run_id IN (${selection}) LIMIT 1000) RETURNING event_id`,
    sql`DELETE FROM workflow_run_facts WHERE run_id IN (SELECT run_id FROM workflow_run_facts WHERE run_id IN (${selection}) LIMIT 100) RETURNING run_id`,
    sql`DELETE FROM workflow_runs WHERE id IN (${selection} LIMIT 100) RETURNING id`,
  ]
  return Array.get(telemetry, phase).pipe(
    Option.orElse(() =>
      Match.value(scope.kind).pipe(
        Match.when("project", () =>
          Array.get(projectChildren, phase - telemetry.length).pipe(
            Option.map((child) => {
              const table = sql.identifier(child)
              return sql`DELETE FROM ${table} WHERE ctid IN (SELECT ctid FROM ${table} WHERE project_id = ${projectId}::uuid LIMIT 100) RETURNING project_id`
            }),
          ),
        ),
        Match.orElse(() =>
          Array.get(
            ["project_api_keys", "project_browser_keys"] as const,
            phase - telemetry.length,
          ).pipe(
            Option.map((child) => {
              const table = sql.identifier(child)
              return sql`DELETE FROM ${table} WHERE id IN (SELECT id FROM ${table} WHERE project_id = ${projectId}::uuid AND credential_epoch < ${credentialEpoch} LIMIT 100) RETURNING id`
            }),
          ),
        ),
      ),
    ),
    Option.getOrNull,
  )
}
