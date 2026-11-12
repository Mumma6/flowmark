CREATE TABLE "data_lifecycle_operations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" text NOT NULL,
	"project_id" uuid NOT NULL,
	"project_name" text NOT NULL,
	"scope" jsonb NOT NULL,
	"counts" jsonb NOT NULL,
	"state" text DEFAULT 'previewed' NOT NULL,
	"phase" integer DEFAULT 0 NOT NULL,
	"deleted_events" integer DEFAULT 0 NOT NULL,
	"deleted_runs" integer DEFAULT 0 NOT NULL,
	"failure_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "project_api_keys" ADD COLUMN "credential_epoch" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "project_browser_keys" ADD COLUMN "credential_epoch" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "lifecycle_operation_id" uuid;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "credential_epoch" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "new_run_after" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "data_lifecycle_actor_project_idx" ON "data_lifecycle_operations" USING btree ("actor_id","project_id","created_at");--> statement-breakpoint
CREATE INDEX "data_lifecycle_expiry_idx" ON "data_lifecycle_operations" USING btree ("expires_at");--> statement-breakpoint
-- Every application writer, including an older deployment, meets the same row fence.
CREATE FUNCTION flowmark_guard_project_lifecycle() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  row_data jsonb;
  target_project uuid;
  project_state projects%ROWTYPE;
  cleanup text;
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
  SELECT * INTO project_state FROM projects WHERE id = target_project FOR SHARE;
  IF NOT FOUND THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RAISE EXCEPTION 'Project unavailable' USING ERRCODE = '23514';
  END IF;
  cleanup := current_setting('flowmark.cleanup_operation', true);
  IF project_state.lifecycle_operation_id IS NOT NULL AND cleanup IS DISTINCT FROM project_state.lifecycle_operation_id::text THEN
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
CREATE TRIGGER projects_lifecycle_guard BEFORE INSERT OR UPDATE OR DELETE ON projects FOR EACH ROW EXECUTE FUNCTION flowmark_guard_project_lifecycle();
--> statement-breakpoint
CREATE TRIGGER workflows_lifecycle_guard BEFORE INSERT OR UPDATE OR DELETE ON workflows FOR EACH ROW EXECUTE FUNCTION flowmark_guard_project_lifecycle();
--> statement-breakpoint
CREATE TRIGGER workflow_runs_lifecycle_guard BEFORE INSERT OR UPDATE OR DELETE ON workflow_runs FOR EACH ROW EXECUTE FUNCTION flowmark_guard_project_lifecycle();
--> statement-breakpoint
CREATE TRIGGER workflow_events_lifecycle_guard BEFORE INSERT OR UPDATE OR DELETE ON workflow_events FOR EACH ROW EXECUTE FUNCTION flowmark_guard_project_lifecycle();
--> statement-breakpoint
CREATE TRIGGER workflow_expectations_lifecycle_guard BEFORE INSERT OR UPDATE OR DELETE ON workflow_expectations FOR EACH ROW EXECUTE FUNCTION flowmark_guard_project_lifecycle();
--> statement-breakpoint
CREATE TRIGGER workflow_run_facts_lifecycle_guard BEFORE INSERT OR UPDATE OR DELETE ON workflow_run_facts FOR EACH ROW EXECUTE FUNCTION flowmark_guard_project_lifecycle();
--> statement-breakpoint
CREATE TRIGGER workflow_metric_facts_lifecycle_guard BEFORE INSERT OR UPDATE OR DELETE ON workflow_metric_facts FOR EACH ROW EXECUTE FUNCTION flowmark_guard_project_lifecycle();
--> statement-breakpoint
CREATE TRIGGER project_api_keys_lifecycle_guard BEFORE INSERT OR UPDATE OR DELETE ON project_api_keys FOR EACH ROW EXECUTE FUNCTION flowmark_guard_project_lifecycle();
--> statement-breakpoint
CREATE TRIGGER project_browser_keys_lifecycle_guard BEFORE INSERT OR UPDATE OR DELETE ON project_browser_keys FOR EACH ROW EXECUTE FUNCTION flowmark_guard_project_lifecycle();
--> statement-breakpoint
CREATE TRIGGER project_members_lifecycle_guard BEFORE INSERT OR UPDATE OR DELETE ON project_members FOR EACH ROW EXECUTE FUNCTION flowmark_guard_project_lifecycle();
--> statement-breakpoint
CREATE TRIGGER saved_investigations_lifecycle_guard BEFORE INSERT OR UPDATE OR DELETE ON saved_investigations FOR EACH ROW EXECUTE FUNCTION flowmark_guard_project_lifecycle();
--> statement-breakpoint
CREATE TRIGGER workflow_result_declarations_lifecycle_guard BEFORE INSERT OR UPDATE OR DELETE ON workflow_result_declarations FOR EACH ROW EXECUTE FUNCTION flowmark_guard_project_lifecycle();
--> statement-breakpoint
CREATE TRIGGER workflow_search_fields_lifecycle_guard BEFORE INSERT OR UPDATE OR DELETE ON workflow_search_fields FOR EACH ROW EXECUTE FUNCTION flowmark_guard_project_lifecycle();
--> statement-breakpoint
CREATE TRIGGER workflow_definition_imports_lifecycle_guard BEFORE INSERT OR UPDATE OR DELETE ON workflow_definition_imports FOR EACH ROW EXECUTE FUNCTION flowmark_guard_project_lifecycle();
--> statement-breakpoint
CREATE TRIGGER agent_access_grant_projects_lifecycle_guard BEFORE INSERT OR UPDATE OR DELETE ON agent_access_grant_projects FOR EACH ROW EXECUTE FUNCTION flowmark_guard_project_lifecycle();
