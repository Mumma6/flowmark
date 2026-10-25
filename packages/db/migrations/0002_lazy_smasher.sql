ALTER TYPE "public"."workflow_event_type" ADD VALUE 'properties' BEFORE 'completed';--> statement-breakpoint
ALTER TYPE "public"."workflow_event_type" ADD VALUE 'error' BEFORE 'completed';--> statement-breakpoint
ALTER TABLE "workflow_events" ADD COLUMN "error" jsonb;--> statement-breakpoint
ALTER TABLE "workflow_events" ADD COLUMN "result" jsonb;--> statement-breakpoint
ALTER TABLE "workflow_runs" ADD COLUMN "properties" jsonb;--> statement-breakpoint
ALTER TABLE "workflow_runs" ADD COLUMN "error" jsonb;--> statement-breakpoint
ALTER TABLE "workflow_runs" ADD COLUMN "result" jsonb;--> statement-breakpoint
ALTER TABLE "workflow_runs" ADD COLUMN "environment" text;--> statement-breakpoint
ALTER TABLE "workflow_runs" ADD COLUMN "release" text;