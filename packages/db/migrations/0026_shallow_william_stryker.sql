CREATE TABLE "account_lifecycle_operations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"counts" jsonb NOT NULL,
	"state" text DEFAULT 'previewed' NOT NULL,
	"contract_version" integer DEFAULT 1 NOT NULL,
	"phase" integer DEFAULT 0 NOT NULL,
	"completed_projects" integer DEFAULT 0 NOT NULL,
	"child_project_id" uuid,
	"child_operation_id" uuid,
	"capability_hash" text NOT NULL,
	"capability_expires_at" timestamp with time zone NOT NULL,
	"failure_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "lifecycle_operation_id" uuid;--> statement-breakpoint
CREATE INDEX "account_lifecycle_user_idx" ON "account_lifecycle_operations" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "account_lifecycle_expiry_idx" ON "account_lifecycle_operations" USING btree ("expires_at");
--> statement-breakpoint
CREATE OR REPLACE FUNCTION flowmark_guard_project_lifecycle() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  row_data jsonb;
  target_project uuid;
  project_state projects%ROWTYPE;
  cleanup text;
  owner_state record;
BEGIN
  IF TG_OP = 'DELETE' THEN row_data := to_jsonb(OLD); ELSE row_data := to_jsonb(NEW); END IF;
  IF TG_TABLE_NAME = 'projects' THEN
    IF TG_OP = 'INSERT' THEN
      PERFORM 1 FROM workspaces WHERE id = NEW.workspace_id FOR KEY SHARE;
      RETURN NEW;
    END IF;
    target_project := OLD.id;
  ELSIF TG_TABLE_NAME = 'workflows' OR row_data ? 'project_id' THEN
    target_project := (row_data ->> 'project_id')::uuid;
  ELSIF TG_TABLE_NAME = 'workflow_runs' THEN
    SELECT project_id INTO target_project FROM workflows WHERE id = (row_data ->> 'workflow_id')::uuid;
  ELSE
    SELECT w.project_id INTO target_project FROM workflow_runs r JOIN workflows w ON w.id = r.workflow_id WHERE r.id = (row_data ->> 'run_id')::uuid;
  END IF;
  cleanup := current_setting('flowmark.cleanup_operation', true);
  IF TG_OP = 'DELETE' AND TG_TABLE_NAME = 'agent_access_grant_projects' THEN
    -- Revoking a deleting user's own grant/client must not depend on the other
    -- project's independent cleanup finishing first. Never admit new bindings.
    PERFORM 1 FROM oauth_refresh_token r
      LEFT JOIN oauth_client c ON c.client_id = r.client_id
      JOIN "user" u ON u.id = r.user_id OR u.id = c.user_id
      WHERE r.authorization_code_id = OLD.authorization_code_id
        AND u.lifecycle_operation_id::text = cleanup FOR SHARE OF u;
    IF FOUND THEN RETURN OLD; END IF;
  END IF;
  IF TG_OP = 'UPDATE' AND TG_TABLE_NAME = 'workflow_definition_imports' THEN
    IF NEW.actor_id IS NULL AND OLD.actor_id IS NOT NULL
      AND (to_jsonb(NEW) - 'actor_id') = (to_jsonb(OLD) - 'actor_id') THEN
      -- Account erasure may anonymize only its actor reference, even while the
      -- independently owned project is itself fenced. No metadata can change.
      PERFORM 1 FROM "user" WHERE id = OLD.actor_id
        AND lifecycle_operation_id::text = cleanup FOR SHARE;
      IF FOUND THEN RETURN NEW; END IF;
    END IF;
  END IF;
  SELECT * INTO project_state FROM projects WHERE id = target_project;
  IF NOT FOUND THEN
    -- FK cascades run after their owning project row is gone. Its final delete
    -- already held and authorized the project/account fence.
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RAISE EXCEPTION 'Project unavailable' USING ERRCODE = '23514';
  END IF;
  FOR owner_state IN
    SELECT u.lifecycle_operation_id FROM "user" u
    WHERE u.id IN (SELECT m.user_id FROM project_members m WHERE m.project_id = target_project
      UNION SELECT row_data->>'user_id' WHERE TG_TABLE_NAME = 'project_members')
    ORDER BY u.id FOR SHARE
  LOOP
    IF owner_state.lifecycle_operation_id IS NOT NULL
      AND cleanup IS DISTINCT FROM owner_state.lifecycle_operation_id::text
      AND (project_state.lifecycle_operation_id IS NULL OR cleanup IS DISTINCT FROM project_state.lifecycle_operation_id::text) THEN
      RAISE EXCEPTION 'Account cleanup in progress' USING ERRCODE = '23514';
    END IF;
  END LOOP;
  SELECT * INTO project_state FROM projects WHERE id = target_project FOR SHARE;
  IF NOT FOUND THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RAISE EXCEPTION 'Project unavailable' USING ERRCODE = '23514';
  END IF;
  cleanup := current_setting('flowmark.cleanup_operation', true);
  IF project_state.lifecycle_operation_id IS NOT NULL AND (project_state.lifecycle_operation_id IS NULL OR cleanup IS DISTINCT FROM project_state.lifecycle_operation_id::text) THEN
    RAISE EXCEPTION 'Project cleanup in progress' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'INSERT' AND TG_TABLE_NAME IN ('project_api_keys', 'project_browser_keys') THEN
    NEW.credential_epoch := project_state.credential_epoch;
  END IF;
  IF TG_OP = 'INSERT' AND TG_TABLE_NAME = 'workflow_runs' THEN
    -- now() is transaction start, which can precede a wait at the project fence.
    -- Preserve explicit historical fixture timestamps; application defaults use receipt time.
    IF NEW.created_at = transaction_timestamp() THEN NEW.created_at := clock_timestamp(); END IF;
  END IF;
  IF TG_OP = 'INSERT' AND TG_TABLE_NAME = 'workflow_runs' AND (row_data ->> 'started_at')::timestamptz <= project_state.new_run_after THEN
    RAISE EXCEPTION 'Run start precedes the erasure boundary' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;
--> statement-breakpoint
CREATE FUNCTION flowmark_guard_account_lifecycle() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  row_data jsonb;
  subject_user text;
  client_owner text;
  previous_user text;
  previous_client_owner text;
  previous_data jsonb;
  owner_state record;
  cleanup text;
  pending boolean := false;
  authorized_cleanup boolean := false;
BEGIN
  IF TG_OP = 'DELETE' THEN row_data := to_jsonb(OLD); ELSE row_data := to_jsonb(NEW); END IF;
  cleanup := current_setting('flowmark.cleanup_operation', true);
  IF TG_TABLE_NAME = 'user' THEN
    subject_user := row_data->>'id';
  ELSIF TG_TABLE_NAME = 'verification' THEN
    IF pg_input_is_valid(row_data->>'value', 'jsonb') THEN
      subject_user := (row_data->>'value')::jsonb->>'userId';
    ELSE subject_user := row_data->>'value'; END IF;
  ELSE subject_user := row_data->>'user_id'; END IF;
  IF row_data ? 'client_id' AND TG_TABLE_NAME <> 'oauth_client' THEN
    SELECT user_id INTO client_owner FROM oauth_client WHERE client_id = row_data->>'client_id';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    previous_data := to_jsonb(OLD);
    IF TG_TABLE_NAME = 'user' THEN previous_user := previous_data->>'id';
    ELSIF TG_TABLE_NAME = 'verification' THEN
      IF pg_input_is_valid(previous_data->>'value', 'jsonb') THEN previous_user := (previous_data->>'value')::jsonb->>'userId';
      ELSE previous_user := previous_data->>'value'; END IF;
    ELSE previous_user := previous_data->>'user_id'; END IF;
    IF previous_data ? 'client_id' AND TG_TABLE_NAME <> 'oauth_client' THEN
      SELECT user_id INTO previous_client_owner FROM oauth_client WHERE client_id = previous_data->>'client_id';
    END IF;
  END IF;
  FOR owner_state IN SELECT lifecycle_operation_id FROM "user"
    WHERE id IN (subject_user, client_owner, previous_user, previous_client_owner) ORDER BY id FOR SHARE
  LOOP
    IF owner_state.lifecycle_operation_id IS NOT NULL THEN
      pending := true;
      IF cleanup = owner_state.lifecycle_operation_id::text THEN authorized_cleanup := true; END IF;
    END IF;
  END LOOP;
  IF pending AND NOT authorized_cleanup THEN
    RAISE EXCEPTION 'Account cleanup in progress' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER user_account_lifecycle_guard BEFORE UPDATE OR DELETE ON "user" FOR EACH ROW EXECUTE FUNCTION flowmark_guard_account_lifecycle();
--> statement-breakpoint
CREATE TRIGGER session_account_lifecycle_guard BEFORE INSERT OR UPDATE OR DELETE ON session FOR EACH ROW EXECUTE FUNCTION flowmark_guard_account_lifecycle();
--> statement-breakpoint
CREATE TRIGGER account_account_lifecycle_guard BEFORE INSERT OR UPDATE OR DELETE ON account FOR EACH ROW EXECUTE FUNCTION flowmark_guard_account_lifecycle();
--> statement-breakpoint
CREATE TRIGGER verification_account_lifecycle_guard BEFORE INSERT OR UPDATE OR DELETE ON verification FOR EACH ROW EXECUTE FUNCTION flowmark_guard_account_lifecycle();
--> statement-breakpoint
CREATE TRIGGER oauth_client_account_lifecycle_guard BEFORE INSERT OR UPDATE OR DELETE ON oauth_client FOR EACH ROW EXECUTE FUNCTION flowmark_guard_account_lifecycle();
--> statement-breakpoint
CREATE TRIGGER oauth_refresh_account_lifecycle_guard BEFORE INSERT OR UPDATE OR DELETE ON oauth_refresh_token FOR EACH ROW EXECUTE FUNCTION flowmark_guard_account_lifecycle();
--> statement-breakpoint
CREATE TRIGGER oauth_access_account_lifecycle_guard BEFORE INSERT OR UPDATE OR DELETE ON oauth_access_token FOR EACH ROW EXECUTE FUNCTION flowmark_guard_account_lifecycle();
--> statement-breakpoint
CREATE TRIGGER oauth_consent_account_lifecycle_guard BEFORE INSERT OR UPDATE OR DELETE ON oauth_consent FOR EACH ROW EXECUTE FUNCTION flowmark_guard_account_lifecycle();
--> statement-breakpoint
CREATE TRIGGER oauth_client_resource_account_lifecycle_guard BEFORE INSERT OR UPDATE OR DELETE ON oauth_client_resource FOR EACH ROW EXECUTE FUNCTION flowmark_guard_account_lifecycle();
--> statement-breakpoint
CREATE TRIGGER consent_intent_account_lifecycle_guard BEFORE INSERT OR UPDATE OR DELETE ON agent_access_oauth_consent_intents FOR EACH ROW EXECUTE FUNCTION flowmark_guard_account_lifecycle();
--> statement-breakpoint
CREATE TRIGGER connection_last_auth_account_lifecycle_guard BEFORE INSERT OR UPDATE OR DELETE ON agent_access_connection_last_auth FOR EACH ROW EXECUTE FUNCTION flowmark_guard_account_lifecycle();
