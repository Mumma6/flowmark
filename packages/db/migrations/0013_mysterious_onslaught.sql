ALTER TYPE "public"."workflow_event_type" ADD VALUE 'expectation_declared' BEFORE 'started';--> statement-breakpoint
ALTER TYPE "public"."workflow_event_type" ADD VALUE 'expectation_resolved' BEFORE 'started';--> statement-breakpoint
ALTER TYPE "public"."workflow_event_type" ADD VALUE 'expectation_cancelled' BEFORE 'started';--> statement-breakpoint
CREATE TABLE "workflow_expectations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"expectation_id" text NOT NULL,
	"declaration_event_id" uuid,
	"settlement_event_id" uuid,
	"declared_at" timestamp with time zone,
	"deadline_at" timestamp with time zone,
	"settled_at" timestamp with time zone,
	"settlement_type" text
);
--> statement-breakpoint
ALTER TABLE "workflow_events" ADD COLUMN "expectation" jsonb;--> statement-breakpoint
ALTER TABLE "workflow_events" ADD COLUMN "expectation_observed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "workflow_expectations" ADD CONSTRAINT "workflow_expectations_run_id_workflow_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."workflow_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_expectations" ADD CONSTRAINT "workflow_expectations_declaration_event_id_workflow_events_id_fk" FOREIGN KEY ("declaration_event_id") REFERENCES "public"."workflow_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_expectations" ADD CONSTRAINT "workflow_expectations_settlement_event_id_workflow_events_id_fk" FOREIGN KEY ("settlement_event_id") REFERENCES "public"."workflow_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "workflow_expectations_run_identity_uidx" ON "workflow_expectations" USING btree ("run_id","expectation_id");--> statement-breakpoint
CREATE INDEX "workflow_expectations_deadline_idx" ON "workflow_expectations" USING btree ("deadline_at","run_id") WHERE "workflow_expectations"."settlement_event_id" is null;