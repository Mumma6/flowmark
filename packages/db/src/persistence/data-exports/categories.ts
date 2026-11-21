import { sql, type SQL } from "drizzle-orm"
import { Array } from "effect"

/** Positive column allowlists. Never use SELECT *, to_jsonb(table), or secret denylists. */
const category = (
  name: string,
  fields: string,
  predicate: SQL,
  keys = "id",
  cutoff = true,
) => {
  const uuid =
    keys === "id" &&
    !Array.contains(
      [
        "user",
        "account",
        "oauth_client",
        "oauth_consent",
        "agent_access_oauth_consent_intents",
      ],
      name,
    )
  const key = uuid
    ? sql`e.id`
    : sql`jsonb_build_array(${sql.join(
        Array.map(keys.split(" "), (field) => sql`e.${sql.identifier(field)}`),
        sql`, `,
      )})::text COLLATE "C"`
  return {
    name,
    table: sql.identifier(name),
    value: sql`jsonb_build_object(${sql.join(
      Array.flatMap(fields.split(" "), (field) => [
        sql`${field}::text`,
        Array.contains(
          ["receipt_order", "progress_completed", "progress_total"],
          field,
        )
          ? sql`e.${sql.identifier(field)}::text`
          : sql`e.${sql.identifier(field)}`,
      ]),
      sql`, `,
    )})`,
    key,
    after: (value: string) =>
      value.length === 0
        ? sql`true`
        : sql`${key} > ${uuid ? sql`${value}::uuid` : sql`${value}`}`,
    predicate,
    cutoff,
  }
}

export const exportCategories = (userId: string, projectId: string | null) => {
  const own = sql`e.owner_id = ${userId}`
  if (projectId === null) {
    return [
      category(
        "account",
        "id account_id provider_id user_id created_at updated_at",
        sql`e.user_id = ${userId}`,
      ),
      category(
        "agent_access_grant_projects",
        "authorization_code_id project_id",
        sql`EXISTS (SELECT 1 FROM oauth_refresh_token t WHERE t.authorization_code_id=e.authorization_code_id AND t.user_id=${userId})`,
        "authorization_code_id project_id",
        false,
      ),
      category(
        "agent_access_oauth_consent_intents",
        "id client_id oauth_consent_id authorization_code_id resource_url requested_scopes state created_at updated_at",
        sql`e.user_id = ${userId}`,
      ),
      category(
        "user",
        "id name email email_verified image created_at updated_at onboarding_step onboarding_completed_at",
        sql`e.id = ${userId}`,
      ),
      category(
        "project_members",
        "project_id user_id role",
        sql`e.user_id = ${userId}`,
        "project_id user_id",
        false,
      ),
      category(
        "personal_workspaces",
        "user_id workspace_id",
        sql`e.user_id = ${userId}`,
        "user_id",
        false,
      ),
      category(
        "saved_investigations",
        "id owner_id project_id title selection created_at",
        own,
      ),
      category(
        "oauth_consent",
        "id client_id scopes resources created_at updated_at",
        sql`e.user_id = ${userId}`,
      ),
      category(
        "agent_access_connection_last_auth",
        "authorization_code_id client_id last_authenticated_at updated_at",
        sql`e.user_id = ${userId}`,
        "authorization_code_id",
        false,
      ),
      category(
        "oauth_client",
        "id client_id name scopes redirect_uris disabled created_at updated_at",
        sql`e.user_id = ${userId}`,
      ),
    ]
  }
  const project = sql`e.project_id = ${projectId}::uuid`
  const run = sql`EXISTS (SELECT 1 FROM workflows w WHERE w.id = e.workflow_id AND w.project_id = ${projectId}::uuid)`
  const event = sql`EXISTS (SELECT 1 FROM workflow_runs r JOIN workflows w ON w.id = r.workflow_id WHERE r.id = e.run_id AND w.project_id = ${projectId}::uuid)`
  return [
    category(
      "projects",
      "id workspace_id name created_at new_run_after",
      sql`e.id = ${projectId}::uuid`,
    ),
    category("workflows", "id project_id name created_at", project),
    category(
      "workflow_runs",
      "id workflow_id external_id started_at properties error result outcome environment release correlation_id parent_run_id retry_of created_at",
      run,
    ),
    category(
      "workflow_events",
      "id event_id receipt_order run_id type step operation_id operation_name attempt duration_ms progress_completed progress_total progress_unit reason properties error result outcome expectation expectation_effective expectation_owner_id expectation_observed_at occurred_at created_at",
      event,
    ),
    category(
      "workflow_expectations",
      "id run_id expectation_id declaration_event_id settlement_event_id declared_at deadline_at settled_at settlement_type",
      event,
      "id",
      false,
    ),
    category(
      "workflow_result_declarations",
      "id project_id workflow revision declaration source created_at",
      project,
    ),
    category(
      "workflow_search_fields",
      "project_id workflow fields sources",
      project,
      "project_id workflow",
      false,
    ),
    category(
      "workflow_definition_imports",
      "id project_id workflow source manifest_fingerprint base_fingerprint actor_id result_revision added_search_keys created_at",
      project,
    ),
    category(
      "project_members",
      "project_id user_id role",
      project,
      "project_id user_id",
      false,
    ),
    category(
      "project_invitations",
      "id project_id inviter_id recipient_user_id email state role delivery expires_at created_at updated_at",
      project,
    ),
    category(
      "project_api_keys",
      "id project_id name permission created_at",
      project,
    ),
    category(
      "project_browser_keys",
      "id project_id name allowed_origins created_at",
      project,
    ),
    category(
      "project_evidence_publications",
      "project_id revision publication updated_at",
      project,
      "project_id",
      false,
    ),
    category(
      "saved_investigations",
      "id owner_id project_id title selection created_at",
      sql`${project} AND ${own}`,
    ),
    category(
      "shared_investigations",
      "id creator_id project_id title selection created_at meaning_proposal proposal_resolution proposal_resolved_by proposal_resolved_at",
      project,
    ),
  ]
}
