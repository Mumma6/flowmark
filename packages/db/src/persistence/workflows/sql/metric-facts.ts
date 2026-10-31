import { sql } from "drizzle-orm"

/** Raw fallback only for runs awaiting the explicitly operated backfill. */
export const metricFactsSql = (projectId: string, runId?: string) => sql`(
  SELECT f.event_id AS id, f.run_id, f.type, f.operation_id, f.operation_name,
    f.duration_ms, f.fail_code, f.occurred_at, f.created_at
  FROM workflow_metric_facts f
  JOIN workflow_run_facts ready ON ready.run_id = f.run_id AND ready.version = 1
  JOIN workflow_runs owner ON owner.id = f.run_id
  JOIN workflows scope ON scope.id = owner.workflow_id
  WHERE scope.project_id = ${projectId}::uuid
    AND (${runId ?? null}::uuid IS NULL OR f.run_id = ${runId ?? null}::uuid)
  UNION ALL
  SELECT e.id, e.run_id, e.type, e.operation_id, e.operation_name,
    e.duration_ms, CASE WHEN e.type = 'failed' THEN e.error ->> 'code' END,
    e.occurred_at, e.created_at
  FROM workflow_runs pending
  JOIN workflows scope ON scope.id = pending.workflow_id
  LEFT JOIN workflow_run_facts ready ON ready.run_id = pending.id AND ready.version = 1
  CROSS JOIN LATERAL (
    SELECT e.* FROM workflow_events e WHERE e.run_id = pending.id AND ready.run_id IS NULL
      AND e.type IN ('operation_started', 'operation_completed', 'operation_failed', 'failed')
  ) e
  WHERE ready.run_id IS NULL AND scope.project_id = ${projectId}::uuid
    AND (${runId ?? null}::uuid IS NULL OR pending.id = ${runId ?? null}::uuid)
)`
