CREATE TABLE "workflow_metric_facts" (
	"event_id" uuid PRIMARY KEY NOT NULL,
	"run_id" uuid NOT NULL,
	"type" "workflow_event_type" NOT NULL,
	"operation_id" uuid,
	"operation_name" text,
	"duration_ms" double precision,
	"fail_code" text,
	"occurred_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_run_facts" (
	"run_id" uuid PRIMARY KEY NOT NULL,
	"version" integer NOT NULL,
	"source_receipt" bigint NOT NULL,
	"selection" jsonb NOT NULL,
	"status" text NOT NULL,
	"duration_ms" double precision,
	"step" text,
	"result" jsonb,
	"definition_revision" text,
	"fail_code" text
);
--> statement-breakpoint
ALTER TABLE "workflow_metric_facts" ADD CONSTRAINT "workflow_metric_facts_event_id_workflow_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."workflow_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_metric_facts" ADD CONSTRAINT "workflow_metric_facts_run_id_workflow_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."workflow_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_run_facts" ADD CONSTRAINT "workflow_run_facts_run_id_workflow_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."workflow_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "workflow_metric_facts_run_idx" ON "workflow_metric_facts" USING btree ("run_id","occurred_at");
--> statement-breakpoint
-- Same-transaction projections cover old and new application writers alike.
-- No historical scan runs during migration. All functions are SECURITY INVOKER.
CREATE FUNCTION flowmark_rebuild_run_facts(target_run uuid) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM 1 FROM workflow_runs WHERE id = target_run FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  INSERT INTO workflow_run_facts (run_id, version, source_receipt, selection, status, duration_ms, step, result, definition_revision, fail_code)
  SELECT r.id, 1, coalesce(max(e.receipt_order), 0), jsonb_build_object(
 'step', (array_agg(jsonb_build_array(extract(epoch FROM e.occurred_at), extract(epoch FROM e.created_at), e.id::text) ORDER BY e.occurred_at DESC, e.created_at DESC, e.id DESC) FILTER (WHERE e.step IS NOT NULL))[1],
 'result', (array_agg(jsonb_build_array(extract(epoch FROM e.occurred_at), extract(epoch FROM e.created_at), e.id::text) ORDER BY e.occurred_at DESC, e.created_at DESC, e.id DESC) FILTER (WHERE e.type IN ('completed','failed') AND e.result IS NOT NULL))[1],
 'failure', (array_agg(jsonb_build_array(extract(epoch FROM e.occurred_at), extract(epoch FROM e.created_at), e.id::text) ORDER BY e.occurred_at DESC, e.created_at DESC, e.id DESC) FILTER (WHERE e.type = 'failed' AND e.error ->> 'code' IS NOT NULL))[1],
 'start', (array_agg(jsonb_build_array(extract(epoch FROM e.created_at), e.id::text) ORDER BY e.created_at, e.id) FILTER (WHERE e.type = 'started'))[1]
),
  CASE
        WHEN bool_or(e.type = 'failed') THEN 'Failed'
        WHEN bool_or(e.type = 'completed') THEN 'Completed'
        ELSE 'Running'
      END AS status,
      (
        extract(epoch FROM (
          max(e.occurred_at) FILTER (WHERE e.type IN ('completed', 'failed'))
          - r.started_at
        )) * 1000
      )::float8 AS "durationMs",
      (
        array_agg(e.step ORDER BY e.occurred_at DESC, e.created_at DESC, e.id DESC)
        FILTER (WHERE e.step IS NOT NULL)
      )[1] AS step,
      (
        array_agg(e.result ORDER BY e.occurred_at DESC, e.created_at DESC, e.id DESC)
        FILTER (WHERE e.type IN ('completed', 'failed') AND e.result IS NOT NULL)
      )[1] AS result,
      (array_agg(CASE WHEN jsonb_typeof(e.properties -> 'definitionRevision') = 'string' THEN e.properties ->> 'definitionRevision' END ORDER BY e.created_at, e.id)
        FILTER (WHERE e.type = 'started'))[1] AS "definitionRevision",
      (
        array_agg(e.error ->> 'code' ORDER BY e.occurred_at DESC, e.created_at DESC, e.id DESC)
        FILTER (WHERE e.type = 'failed' AND e.error ->> 'code' IS NOT NULL)
      )[1] AS "failCode"

  FROM workflow_runs r LEFT JOIN workflow_events e ON e.run_id = r.id
  WHERE r.id = target_run GROUP BY r.id
  ON CONFLICT (run_id) DO UPDATE SET
    version = excluded.version, source_receipt = excluded.source_receipt, selection = excluded.selection,
    status = excluded.status, duration_ms = excluded.duration_ms, step = excluded.step,
    result = excluded.result, definition_revision = excluded.definition_revision, fail_code = excluded.fail_code;
  DELETE FROM workflow_metric_facts WHERE run_id = target_run;
  INSERT INTO workflow_metric_facts (event_id, run_id, type, operation_id, operation_name, duration_ms, fail_code, occurred_at, created_at)
  SELECT e.id, e.run_id, e.type, e.operation_id, e.operation_name, e.duration_ms, CASE WHEN e.type = 'failed' THEN e.error ->> 'code' END, e.occurred_at, e.created_at FROM workflow_events e
  WHERE e.run_id = target_run AND e.type IN ('operation_started','operation_completed','operation_failed','failed');
END;
$$;
--> statement-breakpoint
CREATE FUNCTION flowmark_project_event_facts() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  started timestamptz;
  ordering jsonb;
  start_ordering jsonb;
BEGIN
  SELECT started_at INTO started FROM workflow_runs WHERE id = NEW.run_id FOR UPDATE;
  IF NOT EXISTS (SELECT 1 FROM workflow_run_facts WHERE run_id = NEW.run_id AND version = 1) THEN
    PERFORM flowmark_rebuild_run_facts(NEW.run_id);
    RETURN NEW;
  END IF;
  ordering := jsonb_build_array(extract(epoch FROM NEW.occurred_at), extract(epoch FROM NEW.created_at), NEW.id::text);
  start_ordering := jsonb_build_array(extract(epoch FROM NEW.created_at), NEW.id::text);
  UPDATE workflow_run_facts SET
    source_receipt = greatest(source_receipt, NEW.receipt_order),
    status = CASE WHEN NEW.type = 'failed' THEN 'Failed' WHEN NEW.type = 'completed' AND status = 'Running' THEN 'Completed' ELSE status END,
    duration_ms = CASE WHEN NEW.type IN ('completed','failed') THEN greatest(duration_ms, extract(epoch FROM (NEW.occurred_at - started)) * 1000) ELSE duration_ms END,
    step = CASE WHEN NEW.step IS NOT NULL AND ordering > coalesce(nullif(selection -> 'step', 'null'::jsonb), '[]'::jsonb) THEN NEW.step ELSE step END,
    result = CASE WHEN NEW.type IN ('completed','failed') AND NEW.result IS NOT NULL AND ordering > coalesce(nullif(selection -> 'result', 'null'::jsonb), '[]'::jsonb) THEN NEW.result ELSE result END,
    fail_code = CASE WHEN NEW.type = 'failed' AND NEW.error ->> 'code' IS NOT NULL AND ordering > coalesce(nullif(selection -> 'failure', 'null'::jsonb), '[]'::jsonb) THEN NEW.error ->> 'code' ELSE fail_code END,
    definition_revision = CASE WHEN NEW.type = 'started' AND (selection -> 'start' = 'null'::jsonb OR start_ordering < selection -> 'start') THEN CASE WHEN jsonb_typeof(NEW.properties -> 'definitionRevision') = 'string' THEN NEW.properties ->> 'definitionRevision' END ELSE definition_revision END,
    selection = selection || jsonb_build_object(
      'step', CASE WHEN NEW.step IS NOT NULL AND ordering > coalesce(nullif(selection -> 'step', 'null'::jsonb), '[]'::jsonb) THEN ordering ELSE selection -> 'step' END,
      'result', CASE WHEN NEW.type IN ('completed','failed') AND NEW.result IS NOT NULL AND ordering > coalesce(nullif(selection -> 'result', 'null'::jsonb), '[]'::jsonb) THEN ordering ELSE selection -> 'result' END,
      'failure', CASE WHEN NEW.type = 'failed' AND NEW.error ->> 'code' IS NOT NULL AND ordering > coalesce(nullif(selection -> 'failure', 'null'::jsonb), '[]'::jsonb) THEN ordering ELSE selection -> 'failure' END,
      'start', CASE WHEN NEW.type = 'started' AND (selection -> 'start' = 'null'::jsonb OR start_ordering < selection -> 'start') THEN start_ordering ELSE selection -> 'start' END
    )
  WHERE run_id = NEW.run_id;
  IF NEW.type IN ('operation_started','operation_completed','operation_failed','failed') THEN
    INSERT INTO workflow_metric_facts (event_id, run_id, type, operation_id, operation_name, duration_ms, fail_code, occurred_at, created_at) VALUES (
      NEW.id, NEW.run_id, NEW.type, NEW.operation_id, NEW.operation_name, NEW.duration_ms,
      CASE WHEN NEW.type = 'failed' THEN NEW.error ->> 'code' END, NEW.occurred_at, NEW.created_at
    );
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER workflow_events_project_facts AFTER INSERT ON workflow_events
FOR EACH ROW EXECUTE FUNCTION flowmark_project_event_facts();
