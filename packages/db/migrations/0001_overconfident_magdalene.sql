CREATE TABLE "project_browser_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"key_hash" text NOT NULL,
	"allowed_origins" jsonb NOT NULL,
	"rate_window_started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"rate_window_count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "project_browser_keys_key_hash_unique" UNIQUE("key_hash")
);
--> statement-breakpoint
ALTER TABLE "project_browser_keys" ADD CONSTRAINT "project_browser_keys_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;