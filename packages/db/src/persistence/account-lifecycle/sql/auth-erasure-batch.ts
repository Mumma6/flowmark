import { sql } from "drizzle-orm"

/** Persisted phase order: drain high-cardinality leaves before their FK parents. */
export const authErasureBatches = (userId: string, operationId: string) => {
  const clients = sql`SELECT client_id FROM oauth_client WHERE user_id = ${userId}`
  const sessions = sql`SELECT id FROM session WHERE user_id = ${userId}`
  const refresh = sql`SELECT id FROM oauth_refresh_token WHERE user_id = ${userId} OR client_id IN (${clients}) OR session_id IN (${sessions})`
  const families = sql`SELECT authorization_code_id FROM oauth_refresh_token WHERE id IN (${refresh})`
  return [
    sql`DELETE FROM agent_access_grant_projects WHERE ctid IN (SELECT ctid FROM agent_access_grant_projects WHERE authorization_code_id IN (${families}) LIMIT 100) RETURNING project_id`,
    sql`DELETE FROM agent_access_connection_last_auth WHERE authorization_code_id IN (SELECT authorization_code_id FROM agent_access_connection_last_auth WHERE user_id = ${userId} OR client_id IN (${clients}) LIMIT 100) RETURNING authorization_code_id`,
    sql`DELETE FROM agent_access_oauth_consent_intents WHERE id IN (SELECT id FROM agent_access_oauth_consent_intents WHERE user_id = ${userId} OR client_id IN (${clients}) LIMIT 100) RETURNING id`,
    sql`DELETE FROM oauth_consent WHERE id IN (SELECT id FROM oauth_consent WHERE user_id = ${userId} OR client_id IN (${clients}) LIMIT 100) RETURNING id`,
    sql`DELETE FROM oauth_access_token WHERE id IN (SELECT id FROM oauth_access_token WHERE user_id = ${userId} OR client_id IN (${clients}) OR refresh_id IN (${refresh}) OR session_id IN (${sessions}) LIMIT 100) RETURNING id`,
    sql`DELETE FROM oauth_refresh_token WHERE id IN (${refresh} LIMIT 100) RETURNING id`,
    sql`DELETE FROM oauth_client_resource WHERE id IN (SELECT id FROM oauth_client_resource WHERE client_id IN (${clients}) LIMIT 100) RETURNING id`,
    sql`DELETE FROM oauth_client WHERE id IN (SELECT id FROM oauth_client WHERE user_id = ${userId} LIMIT 100) RETURNING id`,
    sql`DELETE FROM verification WHERE id IN (SELECT id FROM verification WHERE value = ${userId} OR identifier = (SELECT email FROM "user" WHERE id = ${userId}) OR CASE WHEN pg_input_is_valid(value, 'jsonb') THEN value::jsonb->>'userId' = ${userId} ELSE false END LIMIT 100) RETURNING id`,
    sql`DELETE FROM session WHERE id IN (SELECT id FROM session WHERE user_id = ${userId} LIMIT 100) RETURNING id`,
    sql`DELETE FROM account WHERE id IN (SELECT id FROM account WHERE user_id = ${userId} LIMIT 100) RETURNING id`,
    sql`DELETE FROM saved_investigations WHERE id IN (SELECT id FROM saved_investigations WHERE owner_id = ${userId} LIMIT 100) RETURNING id`,
    sql`UPDATE workflow_definition_imports SET actor_id = NULL WHERE id IN (SELECT id FROM workflow_definition_imports WHERE actor_id = ${userId} LIMIT 100) RETURNING id`,
    sql`DELETE FROM data_lifecycle_operations WHERE id IN (SELECT id FROM data_lifecycle_operations WHERE actor_id = ${userId} LIMIT 100) RETURNING id`,
    sql`DELETE FROM account_lifecycle_operations WHERE id IN (SELECT id FROM account_lifecycle_operations WHERE user_id = ${userId} AND id <> ${operationId}::uuid LIMIT 100) RETURNING id`,
    sql`DELETE FROM project_invitations WHERE id IN (SELECT id FROM project_invitations WHERE inviter_id = ${userId} OR recipient_user_id = ${userId} OR email = (SELECT email FROM "user" WHERE id = ${userId}) LIMIT 100) RETURNING id`,
    sql`DELETE FROM project_members WHERE ctid IN (SELECT ctid FROM project_members WHERE user_id = ${userId} AND role IN ('viewer', 'business') ORDER BY project_id LIMIT 100) RETURNING project_id`,
    sql`WITH homes AS (DELETE FROM personal_workspaces WHERE user_id = ${userId} RETURNING workspace_id) DELETE FROM workspaces w USING homes h WHERE w.id = h.workspace_id AND NOT EXISTS (SELECT 1 FROM projects p WHERE p.workspace_id = w.id) RETURNING w.id`,
  ] as const
}
