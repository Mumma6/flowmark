import { sql } from "drizzle-orm"
import type { CoverageObservationQuery } from "@flowmarkdev/core"

export const COVERAGE_OBSERVATION_CAP = 400

export const coverageObservationSql = (
  projectId: string,
  query: CoverageObservationQuery,
) => sql`
  SELECT e.event_id::text AS "eventId",
    (
      SELECT ref->>'digest'
      FROM jsonb_array_elements(
        CASE WHEN jsonb_typeof(e.runtime_observation #> '{observation,references}') = 'array'
          THEN e.runtime_observation #> '{observation,references}'
          ELSE '[]'::jsonb
        END
      ) AS ref
      WHERE ref->>'kind' = 'change'
      LIMIT 1
    ) AS handle,
    e.runtime_observation #>> '{observation,kind}' AS kind,
    e.runtime_observation #>> '{observation,probe,artifactDigest}' AS "artifactDigest",
    e.runtime_observation #>> '{binding,environment}' AS environment,
    e.runtime_observation #>> '{binding,behaviorRevision}' AS "behaviorRevision",
    to_char(e.occurred_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "occurredAt"
  FROM workflow_events e
  JOIN workflow_runs r ON r.id = e.run_id
  JOIN workflows w ON w.id = r.workflow_id
  WHERE w.project_id = ${projectId}::uuid
    AND e.occurred_at >= ${query.startedAt}::timestamptz
    AND e.occurred_at < ${query.endedAt}::timestamptz
    AND e.runtime_observation #>> '{observation,probe,artifactDigest}' = ${query.artifactDigest}
    AND e.runtime_observation #>> '{binding,environment}' = ${query.environment}
    AND e.runtime_observation #>> '{binding,behaviorRevision}' = ${query.behaviorRevision}
    AND e.runtime_observation #>> '{binding,status}' = 'bound'
    AND e.runtime_observation #>> '{observation,kind}' IN ('observation', 'loss')
  ORDER BY e.event_id
  LIMIT ${COVERAGE_OBSERVATION_CAP + 1}
`
