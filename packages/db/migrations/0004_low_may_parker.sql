ALTER TABLE "workflow_runs" ADD COLUMN "correlation_id" text;--> statement-breakpoint
ALTER TABLE "workflow_runs" ADD COLUMN "parent_run_id" text;--> statement-breakpoint
CREATE INDEX "workflow_runs_correlation_workflow_idx" ON "workflow_runs" USING btree ("correlation_id","workflow_id","started_at");--> statement-breakpoint
CREATE INDEX "workflow_runs_parent_workflow_idx" ON "workflow_runs" USING btree ("parent_run_id","workflow_id","started_at");