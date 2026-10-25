ALTER TABLE "project_api_keys" ADD COLUMN "name" text DEFAULT 'API key' NOT NULL;--> statement-breakpoint
ALTER TABLE "project_api_keys" ADD COLUMN "key_prefix" text DEFAULT 'fm_••••' NOT NULL;--> statement-breakpoint
ALTER TABLE "project_api_keys" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "project_browser_keys" ADD COLUMN "name" text DEFAULT 'Browser key' NOT NULL;--> statement-breakpoint
ALTER TABLE "project_browser_keys" ADD COLUMN "key_prefix" text DEFAULT 'fm_••••' NOT NULL;--> statement-breakpoint
ALTER TABLE "project_browser_keys" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;