CREATE TABLE "workflow_search_fields" (
	"project_id" uuid NOT NULL,
	"workflow" text NOT NULL,
	"fields" jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "workflow_search_fields" ADD CONSTRAINT "workflow_search_fields_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "workflow_search_fields_scope_uidx" ON "workflow_search_fields" USING btree ("project_id","workflow");--> statement-breakpoint
CREATE INDEX "workflow_runs_properties_gin_idx" ON "workflow_runs" USING gin ("properties" jsonb_path_ops);