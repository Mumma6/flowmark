-- AFTER ROW triggers may observe other rows from the same bulk insert.
-- The initial per-run rebuild already projected those metric receipts.
CREATE OR REPLACE FUNCTION flowmark_project_event_facts() RETURNS trigger
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
    ) ON CONFLICT (event_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
