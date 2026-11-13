CREATE TABLE "evidence_captures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creator_id" text NOT NULL,
	"project_id" uuid NOT NULL,
	"source_run_id" uuid NOT NULL,
	"publication_revision" integer NOT NULL,
	"captured_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"payload" jsonb NOT NULL,
	CONSTRAINT "evidence_capture_size_check" CHECK (octet_length("evidence_captures"."payload"::text)<=65536),
	CONSTRAINT "evidence_capture_lifetime_check" CHECK ("evidence_captures"."expires_at">"evidence_captures"."captured_at" AND "evidence_captures"."expires_at"<="evidence_captures"."captured_at"+interval '24 hours'),
	CONSTRAINT "evidence_capture_revision_check" CHECK ("evidence_captures"."publication_revision">=0)
);
--> statement-breakpoint
ALTER TABLE "evidence_captures" ADD CONSTRAINT "evidence_captures_creator_id_user_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_captures" ADD CONSTRAINT "evidence_captures_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_captures" ADD CONSTRAINT "evidence_captures_source_run_id_workflow_runs_id_fk" FOREIGN KEY ("source_run_id") REFERENCES "public"."workflow_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_captures" ADD CONSTRAINT "evidence_capture_creator_membership_fk" FOREIGN KEY ("creator_id","project_id") REFERENCES "public"."project_members"("user_id","project_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "evidence_captures_project_created_idx" ON "evidence_captures" USING btree ("project_id","captured_at","id");--> statement-breakpoint
CREATE INDEX "evidence_captures_creator_project_idx" ON "evidence_captures" USING btree ("creator_id","project_id");--> statement-breakpoint
CREATE INDEX "evidence_captures_source_idx" ON "evidence_captures" USING btree ("source_run_id");--> statement-breakpoint
CREATE INDEX "evidence_captures_expiry_idx" ON "evidence_captures" USING btree ("expires_at","id");
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
  IF TG_OP = 'DELETE' AND TG_TABLE_NAME IN ('shared_investigations','evidence_captures') THEN
    -- Account cleanup may remove only its creator's saved evidence even in a
    -- separately fenced project. This neither admits reads nor changes evidence.
    PERFORM 1 FROM "user" WHERE id = OLD.creator_id
      AND lifecycle_operation_id::text = cleanup FOR SHARE;
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
    WHERE u.id IN (SELECT m.user_id FROM project_members m WHERE m.project_id = target_project AND m.role = 'owner'
      UNION SELECT row_data->>'user_id' WHERE TG_TABLE_NAME = 'project_members' AND (TG_OP <> 'DELETE' OR row_data->>'role' = 'owner'))
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
CREATE TRIGGER evidence_captures_lifecycle_guard BEFORE INSERT OR DELETE ON evidence_captures FOR EACH ROW EXECUTE FUNCTION flowmark_guard_project_lifecycle();
--> statement-breakpoint
CREATE FUNCTION flowmark_guard_evidence_capture() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='UPDATE' THEN RAISE EXCEPTION 'Evidence captures are immutable; delete and capture again' USING ERRCODE='23514'; END IF;
 PERFORM 1 FROM workflow_runs r JOIN workflows w ON w.id=r.workflow_id
 WHERE r.id=NEW.source_run_id AND w.project_id=NEW.project_id
 AND NEW.expires_at<=LEAST(r.started_at+interval '30 days',r.created_at+interval '30 days')
 AND NEW.captured_at<=clock_timestamp() AND NEW.expires_at>clock_timestamp() FOR SHARE OF r;
 IF NOT FOUND THEN RAISE EXCEPTION 'Capture source unavailable' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER evidence_captures_source_guard BEFORE INSERT OR UPDATE ON evidence_captures FOR EACH ROW EXECUTE FUNCTION flowmark_guard_evidence_capture();
