CREATE TABLE "agent_access_grant_projects" (
	"authorization_code_id" text NOT NULL,
	"project_id" uuid NOT NULL,
	CONSTRAINT "agent_access_grant_projects_authorization_code_id_project_id_pk" PRIMARY KEY("authorization_code_id","project_id")
);
--> statement-breakpoint
ALTER TABLE "agent_access_grant_projects" ADD CONSTRAINT "agent_access_grant_projects_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_access_grant_projects_auth_code_idx" ON "agent_access_grant_projects" USING btree ("authorization_code_id");