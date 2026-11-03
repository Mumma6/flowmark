import { sql } from "drizzle-orm"
import type { FlowmarkDatabase } from "../../src/client.js"

/** Fingerprints, never passwords, tokens or keys, may reach assertion failure output. */
export const protectedFingerprints = (db: FlowmarkDatabase) =>
  db.execute<{ name: string; fingerprint: string }>(sql`
  select 'users' as name, md5(coalesce(string_agg(row_to_json(t)::text, '|' order by t.id), '')) as fingerprint from "user" t
  union all select 'accounts', md5(coalesce(string_agg(row_to_json(t)::text, '|' order by t.id), '')) from account t
  union all select 'sessions', md5(coalesce(string_agg(row_to_json(t)::text, '|' order by t.id), '')) from session t
  union all select 'verifications', md5(coalesce(string_agg(row_to_json(t)::text, '|' order by t.id), '')) from verification t
  union all select 'workspaces', md5(coalesce(string_agg(row_to_json(t)::text, '|' order by t.id), '')) from workspaces t
  union all select 'projects', md5(coalesce(string_agg(row_to_json(t)::text, '|' order by t.id), '')) from projects t
  union all select 'members', md5(coalesce(string_agg(row_to_json(t)::text, '|' order by t.project_id, t.user_id), '')) from project_members t
  union all select 'keys', md5(coalesce(string_agg(row_to_json(t)::text, '|' order by t.id), '')) from project_api_keys t
  union all select 'browser_keys', md5(coalesce(string_agg(row_to_json(t)::text, '|' order by t.id), '')) from project_browser_keys t
  union all select 'result_settings', md5(coalesce(string_agg(row_to_json(t)::text, '|' order by t.id), '')) from workflow_result_declarations t
  union all select 'search_settings', md5(coalesce(string_agg(row_to_json(t)::text, '|' order by t.project_id, t.workflow), '')) from workflow_search_fields t
  order by name
`)

export const fixtureRunRows = (db: FlowmarkDatabase, projectId: string) =>
  db.execute<{
    id: string
    externalId: string
    workflow: string
    properties: Record<string, unknown>
  }>(sql`
  select r.id, r.external_id as "externalId", w.name as workflow, r.properties
  from workflow_runs r join workflows w on w.id=r.workflow_id where w.project_id=${projectId}
  order by r.external_id
`)

export const fixtureEmailVerified = (db: FlowmarkDatabase, email: string) =>
  db.execute<{ verified: boolean }>(
    sql`select email_verified as verified from "user" where email=${email}`,
  )
