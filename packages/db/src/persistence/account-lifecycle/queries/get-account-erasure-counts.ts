import { sql } from "drizzle-orm"
import { Effect } from "effect"
import type { AccountErasureCounts } from "../../../schema/account-lifecycle.js"
import type { DatabaseTransaction } from "../../run-transaction.js"
import { lifecycleQuery } from "../../data-lifecycle/access.js"

export const getAccountErasureCounts = Effect.fn("getAccountErasureCounts")(
  function* (tx: DatabaseTransaction, userId: string) {
    const [row] = yield* lifecycleQuery(() =>
      tx.execute<AccountErasureCounts & Record<string, unknown>>(sql`
    WITH owned AS (SELECT p.id, p.name, p.lifecycle_operation_id, m.role,
      (SELECT count(*) FROM project_members colleague WHERE colleague.project_id = p.id) AS members
      FROM projects p JOIN project_members m ON m.project_id = p.id WHERE m.user_id = ${userId} AND m.role = 'owner'),
    population AS (SELECT r.id FROM workflow_runs r JOIN workflows w ON w.id = r.workflow_id JOIN owned p ON p.id = w.project_id),
    clients AS (SELECT client_id FROM oauth_client WHERE user_id = ${userId}),
    counts AS (SELECT (SELECT count(*)::int FROM owned) AS projects,
      (SELECT count(*)::int FROM population) AS runs,
      (SELECT count(*)::int FROM workflow_events WHERE run_id IN (SELECT id FROM population)) AS events,
      (SELECT count(*)::int FROM project_api_keys WHERE project_id IN (SELECT id FROM owned)) AS "apiKeys",
      (SELECT count(*)::int FROM project_browser_keys WHERE project_id IN (SELECT id FROM owned)) AS "browserKeys",
      (SELECT count(*)::int FROM clients) AS "oauthClients",
      (SELECT count(DISTINCT authorization_code_id)::int FROM oauth_refresh_token WHERE user_id = ${userId} OR client_id IN (SELECT client_id FROM clients)) AS "delegatedGrants",
      (SELECT count(*)::int FROM owned WHERE members <> 1 OR role <> 'owner') AS "sharedProjects",
      (SELECT count(*)::int FROM owned WHERE lifecycle_operation_id IS NOT NULL) AS "unfinishedProjects")
    SELECT counts.*, coalesce((SELECT jsonb_agg(jsonb_build_object('id', id, 'name', name) ORDER BY id) FROM (SELECT id, name FROM owned ORDER BY id LIMIT 25) preview), '[]'::jsonb) AS "previewProjects",
    md5(jsonb_build_array(to_jsonb(counts), (SELECT jsonb_agg(to_jsonb(owned) ORDER BY id) FROM owned),
      (SELECT jsonb_agg(to_jsonb(k) ORDER BY k.id) FROM project_api_keys k WHERE project_id IN (SELECT id FROM owned)),
      (SELECT jsonb_agg(to_jsonb(k) - 'rate_window_started_at' - 'rate_window_count' ORDER BY k.id) FROM project_browser_keys k WHERE project_id IN (SELECT id FROM owned)),
      (SELECT jsonb_agg(client_id ORDER BY client_id) FROM clients),
      (SELECT jsonb_agg(family ORDER BY family) FROM (SELECT DISTINCT authorization_code_id AS family FROM oauth_refresh_token WHERE user_id = ${userId} OR client_id IN (SELECT client_id FROM clients)) families),
      (SELECT coalesce(max(receipt_order),0)::text FROM workflow_events WHERE run_id IN (SELECT id FROM population)))::text) AS revision FROM counts`),
    )
    return row
  },
)
