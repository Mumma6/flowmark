ALTER TABLE "workflow_events" ADD COLUMN "attempt" jsonb;--> statement-breakpoint
ALTER TABLE "workflow_runs" ADD COLUMN "retry_of" jsonb;