ALTER TYPE "public"."workflow_event_type" ADD VALUE 'operation_started' BEFORE 'completed';--> statement-breakpoint
ALTER TYPE "public"."workflow_event_type" ADD VALUE 'operation_completed' BEFORE 'completed';--> statement-breakpoint
ALTER TYPE "public"."workflow_event_type" ADD VALUE 'operation_failed' BEFORE 'completed';--> statement-breakpoint
ALTER TYPE "public"."workflow_event_type" ADD VALUE 'progress' BEFORE 'completed';--> statement-breakpoint
ALTER TABLE "workflow_events" ADD COLUMN "operation_id" uuid;--> statement-breakpoint
ALTER TABLE "workflow_events" ADD COLUMN "operation_name" text;--> statement-breakpoint
ALTER TABLE "workflow_events" ADD COLUMN "duration_ms" double precision;--> statement-breakpoint
ALTER TABLE "workflow_events" ADD COLUMN "progress_completed" bigint;--> statement-breakpoint
ALTER TABLE "workflow_events" ADD COLUMN "progress_total" bigint;--> statement-breakpoint
ALTER TABLE "workflow_events" ADD COLUMN "progress_unit" text;