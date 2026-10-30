CREATE TABLE "workflow_result_declarations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"workflow" text NOT NULL,
	"revision" text NOT NULL,
	"declaration" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "workflow_events" ADD COLUMN "outcome" text;--> statement-breakpoint
ALTER TABLE "workflow_runs" ADD COLUMN "outcome" text;--> statement-breakpoint
ALTER TABLE "workflow_result_declarations" ADD CONSTRAINT "workflow_result_declarations_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "workflow_result_declarations_revision_uidx" ON "workflow_result_declarations" USING btree ("project_id","workflow","revision");