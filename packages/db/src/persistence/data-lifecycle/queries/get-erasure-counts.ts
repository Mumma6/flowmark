import { sql } from "drizzle-orm"
import { Effect } from "effect"
import type { DatabaseTransaction } from "../../run-transaction.js"
import { lifecycleQuery } from "../access.js"
import { selectedRuns } from "../sql/selection.js"
import type { ErasureCounts, ErasureScope } from "../types.js"

export const getErasureCounts = Effect.fn("getErasureCounts")(function* (
  tx: DatabaseTransaction,
  projectId: string,
  scope: ErasureScope,
  cutoff: Date,
) {
  const [row] = yield* lifecycleQuery(() =>
    tx.execute<ErasureCounts & Record<string, unknown>>(sql`
    WITH selected AS (SELECT r.id, r.started_at FROM workflow_runs r JOIN workflows w ON w.id = r.workflow_id WHERE ${selectedRuns(projectId, scope, cutoff)}),
    captures AS (SELECT c.id,c.creator_id,c.source_run_id,c.publication_revision,c.captured_at,c.expires_at FROM evidence_captures c WHERE c.project_id=${projectId}::uuid AND c.source_run_id IN (SELECT id FROM selected)),
    evidence AS (SELECT count(*)::int AS events, coalesce(max(e.receipt_order),0)::text AS receipt FROM workflow_events e JOIN selected s ON s.id = e.run_id),
    configuration AS (SELECT
      (SELECT count(*) FROM workflow_result_declarations WHERE project_id = ${projectId}::uuid) +
      (SELECT count(*) FROM workflow_search_fields WHERE project_id = ${projectId}::uuid) +
      (SELECT count(*) FROM workflow_definition_imports WHERE project_id = ${projectId}::uuid) +
      (SELECT count(*) FROM saved_investigations WHERE project_id = ${projectId}::uuid) +
      (SELECT count(*) FROM captures) AS total)
    SELECT (SELECT count(*)::int FROM selected) AS runs, evidence.events,
      (SELECT count(*)::int FROM project_api_keys WHERE project_id = ${projectId}::uuid) AS "apiKeys",
      (SELECT count(*)::int FROM project_browser_keys WHERE project_id = ${projectId}::uuid) AS "browserKeys",
      configuration.total::int AS configurations,
      (SELECT max(started_at)::text FROM selected) AS "latestStart",
      md5(jsonb_build_array((SELECT array_agg(id ORDER BY id) FROM selected), evidence.events, evidence.receipt,
        (SELECT jsonb_agg(to_jsonb(k) ORDER BY k.id) FROM project_api_keys k WHERE project_id = ${projectId}::uuid),
        (SELECT jsonb_agg(to_jsonb(k) - 'rate_window_started_at' - 'rate_window_count' ORDER BY k.id) FROM project_browser_keys k WHERE project_id = ${projectId}::uuid),
        configuration.total,
        (SELECT jsonb_agg(to_jsonb(d) ORDER BY d.id) FROM workflow_result_declarations d WHERE project_id = ${projectId}::uuid),
        (SELECT jsonb_agg(to_jsonb(f) ORDER BY f.workflow) FROM workflow_search_fields f WHERE project_id = ${projectId}::uuid),
        (SELECT jsonb_agg(to_jsonb(i) ORDER BY i.id) FROM workflow_definition_imports i WHERE project_id = ${projectId}::uuid),
        (SELECT jsonb_agg(to_jsonb(s) ORDER BY s.id) FROM saved_investigations s WHERE project_id = ${projectId}::uuid),
        (SELECT jsonb_agg(to_jsonb(c) ORDER BY c.id) FROM captures c))::text) AS revision
    FROM evidence CROSS JOIN configuration`),
  )
  return row
})
