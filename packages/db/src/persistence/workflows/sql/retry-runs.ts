import { sql } from "drizzle-orm"

/** Resolve both directions using qualified external identities within the authorized project. */
export const retryRunsSql = (projectId: string, runId: string) => sql`
  WITH current AS (
    SELECT r.id, r.external_id, r.retry_of, w.name AS workflow
    FROM workflow_runs r JOIN workflows w ON w.id = r.workflow_id
    WHERE w.project_id = ${projectId} AND r.id = ${runId}
  ), candidates AS (
    SELECT r.id, r.external_id AS "externalId", w.name AS workflow,
      r.started_at AS "startedAt", r.correlation_id AS "correlationId",
      r.parent_run_id AS "parentRunId",
      CASE WHEN w.name = current.retry_of->>'workflow'
        AND r.external_id = current.retry_of->>'runId' THEN 'retryOf' ELSE 'retry' END AS relationship
    FROM workflow_runs r JOIN workflows w ON w.id = r.workflow_id CROSS JOIN current
    WHERE w.project_id = ${projectId} AND r.id != current.id AND (
      (w.name = current.retry_of->>'workflow' AND r.external_id = current.retry_of->>'runId') OR
      (r.retry_of->>'workflow' = current.workflow AND r.retry_of->>'runId' = current.external_id)
    )
  )
  SELECT c.id, c."externalId", c.workflow, c."startedAt"::text AS "startedAt",
    c."correlationId", c."parentRunId", c.relationship,
    CASE WHEN bool_or(e.type = 'failed') THEN 'Failed'
      WHEN bool_or(e.type = 'completed') THEN 'Completed' ELSE 'Running' END AS status
  FROM candidates c LEFT JOIN workflow_events e ON e.run_id = c.id
  GROUP BY c.id, c."externalId", c.workflow, c."startedAt", c."correlationId", c."parentRunId", c.relationship
  ORDER BY c."startedAt", c.id
`
