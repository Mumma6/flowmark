ALTER TYPE "public"."workflow_event_type" ADD VALUE 'report' BEFORE 'completed';--> statement-breakpoint
ALTER TABLE "workflow_events" ADD COLUMN "receipt_order" bigserial NOT NULL;