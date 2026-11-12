CREATE TABLE "workflow_definition_imports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"workflow" text NOT NULL,
	"source" text NOT NULL,
	"manifest_fingerprint" text NOT NULL,
	"base_fingerprint" text NOT NULL,
	"actor_id" text,
	"result_revision" text,
	"added_search_keys" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "workflow_result_declarations" ADD COLUMN "source" text;--> statement-breakpoint
ALTER TABLE "workflow_search_fields" ADD COLUMN "sources" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "workflow_definition_imports" ADD CONSTRAINT "workflow_definition_imports_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_definition_imports" ADD CONSTRAINT "workflow_definition_imports_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "workflow_definition_imports_review_uidx" ON "workflow_definition_imports" USING btree ("project_id","workflow","source","manifest_fingerprint","base_fingerprint");