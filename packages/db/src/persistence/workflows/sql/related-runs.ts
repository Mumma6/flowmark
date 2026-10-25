import { sql } from "drizzle-orm"

export const relatedRunsSql = (projectId: string, runId: string) => sql`
  WITH current AS (
    SELECT
      r.id,
      r.external_id AS "externalId",
      r.correlation_id AS "correlationId",
      r.parent_run_id AS "parentRunId"
    FROM workflow_runs r
    JOIN workflows w ON w.id = r.workflow_id
    WHERE w.project_id = ${projectId} AND r.id = ${runId}
  ),
  candidates AS (
    SELECT
      r.id,
      r.external_id AS "externalId",
      w.name AS workflow,
      r.started_at AS "startedAt",
      r.correlation_id AS "correlationId",
      r.parent_run_id AS "parentRunId"
    FROM workflow_runs r
    JOIN workflows w ON w.id = r.workflow_id
    CROSS JOIN current
    WHERE w.project_id = ${projectId}
      AND r.id != current.id
      AND (
        (
          current."parentRunId" IS NOT NULL
          AND r.external_id = current."parentRunId"
        )
        OR (
          current."correlationId" IS NOT NULL
          AND r.correlation_id = current."correlationId"
        )
      )
  ),
  runs AS (
    SELECT
      candidate.id,
      candidate."externalId",
      candidate.workflow,
      candidate."startedAt",
      candidate."correlationId",
      candidate."parentRunId",
      CASE
        WHEN bool_or(e.type = 'failed') THEN 'Failed'
        WHEN bool_or(e.type = 'completed') THEN 'Completed'
        ELSE 'Running'
      END AS status
    FROM candidates candidate
    LEFT JOIN workflow_events e ON e.run_id = candidate.id
    GROUP BY
      candidate.id,
      candidate."externalId",
      candidate.workflow,
      candidate."startedAt",
      candidate."correlationId",
      candidate."parentRunId"
  )
  SELECT
    candidate.id,
    candidate."externalId",
    candidate.workflow,
    candidate."startedAt"::text AS "startedAt",
    candidate.status,
    candidate."correlationId",
    candidate."parentRunId",
    CASE
      WHEN current."parentRunId" IS NOT NULL
        AND candidate."externalId" = current."parentRunId"
      THEN 'parent'
      ELSE 'correlated'
    END AS relationship
  FROM runs candidate
  CROSS JOIN current
  ORDER BY candidate."startedAt", candidate.id
`
