-- Fail closed before introducing viewer roles; never infer an arbitrary owner.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM project_members WHERE role <> 'owner') OR
     EXISTS (SELECT 1 FROM projects p LEFT JOIN project_members m ON m.project_id = p.id GROUP BY p.id HAVING count(*) FILTER (WHERE m.role = 'owner') <> 1) THEN
    RAISE EXCEPTION 'Project sharing requires exactly one owner per existing project; review and repair ownership before migration' USING ERRCODE = '23514';
  END IF;
END $$;
--> statement-breakpoint
CREATE TABLE "personal_workspaces" (
	"user_id" text PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	CONSTRAINT "personal_workspaces_workspace_id_unique" UNIQUE("workspace_id")
);
--> statement-breakpoint
CREATE TABLE "project_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"inviter_id" text NOT NULL,
	"recipient_user_id" text,
	"email" text NOT NULL,
	"token_hash" text,
	"state" text DEFAULT 'pending' NOT NULL,
	"delivery" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_invitation_state_check" CHECK ("project_invitations"."state" IN ('pending', 'accepted', 'declined', 'revoked')),
	CONSTRAINT "project_invitation_delivery_check" CHECK ("project_invitations"."delivery" IN ('pending', 'submitted', 'failed'))
);
--> statement-breakpoint
ALTER TABLE "personal_workspaces" ADD CONSTRAINT "personal_workspaces_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal_workspaces" ADD CONSTRAINT "personal_workspaces_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_invitations" ADD CONSTRAINT "project_invitations_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_invitations" ADD CONSTRAINT "project_invitations_inviter_id_user_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_invitations" ADD CONSTRAINT "project_invitations_recipient_user_id_user_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "project_invitation_pending_email_uidx" ON "project_invitations" USING btree ("project_id","email") WHERE "project_invitations"."state" = 'pending';--> statement-breakpoint
CREATE INDEX "project_invitation_recipient_idx" ON "project_invitations" USING btree ("recipient_user_id");--> statement-breakpoint
CREATE INDEX "project_invitation_expiry_idx" ON "project_invitations" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "project_members_one_owner_uidx" ON "project_members" USING btree ("project_id") WHERE "project_members"."role" = 'owner';--> statement-breakpoint
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_role_check" CHECK ("project_members"."role" IN ('owner', 'viewer'));
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
CREATE FUNCTION flowmark_guard_project_ownership() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE project_state projects%ROWTYPE;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.role IS DISTINCT FROM OLD.role OR NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.project_id IS DISTINCT FROM OLD.project_id THEN
      RAISE EXCEPTION 'Project ownership and membership identity are immutable; remove and invite viewers explicitly' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;
  IF OLD.role = 'owner' THEN
    SELECT * INTO project_state FROM projects WHERE id = OLD.project_id;
    IF FOUND AND (project_state.lifecycle_operation_id IS NULL OR current_setting('flowmark.cleanup_operation', true) IS DISTINCT FROM project_state.lifecycle_operation_id::text) THEN
      RAISE EXCEPTION 'The sole owner cannot leave or be removed from a live project' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN OLD;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER project_members_owner_guard BEFORE UPDATE OR DELETE ON project_members FOR EACH ROW EXECUTE FUNCTION flowmark_guard_project_ownership();
