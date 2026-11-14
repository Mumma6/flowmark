CREATE TABLE "project_evidence_publications" (
	"project_id" uuid PRIMARY KEY NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"publication" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_evidence_publication_revision_check" CHECK ("project_evidence_publications"."revision" >= 0)
);
--> statement-breakpoint
ALTER TABLE "project_members" DROP CONSTRAINT "project_members_role_check";--> statement-breakpoint
ALTER TABLE "project_invitations" ADD COLUMN "role" text DEFAULT 'viewer' NOT NULL;--> statement-breakpoint
ALTER TABLE "project_evidence_publications" ADD CONSTRAINT "project_evidence_publications_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_invitations" ADD CONSTRAINT "project_invitation_role_check" CHECK ("project_invitations"."role" IN ('viewer', 'business'));--> statement-breakpoint
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_role_check" CHECK ("project_members"."role" IN ('owner', 'viewer', 'business'));
--> statement-breakpoint
CREATE TRIGGER project_evidence_publications_lifecycle_guard BEFORE INSERT OR UPDATE OR DELETE ON project_evidence_publications FOR EACH ROW EXECUTE FUNCTION flowmark_guard_project_lifecycle();
