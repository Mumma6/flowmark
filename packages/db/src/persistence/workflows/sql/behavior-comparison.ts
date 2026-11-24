import { sql } from "drizzle-orm"
import type { BehaviorComparisonQuery } from "@flowmarkdev/core"
import { EXECUTION_SEARCH_RUN_CAP } from "./run-summaries.js"

export const BEHAVIOR_COMPARISON_EVENT_CAP = 20_000

export const behaviorCohortSql = (
  projectId: string,
  query: BehaviorComparisonQuery,
  cohort: BehaviorComparisonQuery["before"],
  artifactDigest: string,
  behaviorRevision: string,
) => sql`
  WITH runs AS MATERIALIZED (
    SELECT r.id
    FROM workflow_runs r JOIN workflows w ON w.id = r.workflow_id
    WHERE w.project_id = ${projectId}::uuid AND w.name = ${query.workflow}
      AND w.name NOT LIKE 'browser.%'
      AND r.started_at >= ${cohort.startedAfter}::timestamptz
      AND r.started_at < ${cohort.startedBefore}::timestamptz
    LIMIT ${EXECUTION_SEARCH_RUN_CAP + 1}
  ), events AS MATERIALIZED (
    SELECT e.run_id, e.event_id::text AS event_id, e.type, e.step, e.outcome,
      e.error ->> 'handled' = 'true' AS handled,
      e.runtime_observation #>> '{observation,kind}' AS kind,
      CASE WHEN e.runtime_observation #>> '{binding,status}' = 'bound'
          AND e.runtime_observation #>> '{observation,probe,bindingId}' = ${query.bindingId}
        THEN e.runtime_observation #>> '{observation,probe,deploymentId}'
      END AS deployment,
      e.runtime_observation #>> '{observation,probe,artifactDigest}' AS artifact,
      e.runtime_observation #>> '{binding,behaviorId}' AS behavior,
      e.runtime_observation #>> '{binding,behaviorRevision}' AS revision,
      (e.runtime_observation #>> '{observation,count}')::bigint AS lost
    FROM runs r JOIN workflow_events e ON e.run_id = r.id
    WHERE (SELECT count(*) FROM runs) <= ${EXECUTION_SEARCH_RUN_CAP}
    LIMIT ${BEHAVIOR_COMPARISON_EVENT_CAP + 1}
  ), classified AS (
    SELECT r.id::text AS "runId",
      min(e.event_id) FILTER (
        WHERE e.kind = 'observation' AND e.deployment = ${cohort.deploymentId}
          AND e.artifact = ${artifactDigest} AND e.behavior = ${query.behaviorId}
          AND e.revision = ${behaviorRevision}
      ) AS "observationEventId",
      coalesce(bool_or(e.kind = 'observation' AND e.deployment <> ${cohort.deploymentId}), false) AS "otherDeployment",
      coalesce(bool_or(e.kind = 'observation' AND e.deployment <> ${cohort.deploymentId}
        AND e.behavior = ${query.behaviorId}), false) AS "otherBehaviorDeployment",
      min(e.event_id) FILTER (
        WHERE e.kind = 'observation' AND e.deployment IS NOT NULL
          AND e.deployment <> ${cohort.deploymentId}
      ) AS "otherObservationEventId",
      min(e.deployment) FILTER (
        WHERE e.kind = 'observation' AND e.deployment IS NOT NULL
          AND e.deployment <> ${cohort.deploymentId}
      ) AS "otherDeploymentId",
      min(e.artifact) FILTER (
        WHERE e.kind = 'observation' AND e.deployment IS NOT NULL
          AND e.deployment <> ${cohort.deploymentId}
      ) AS "otherArtifactDigest",
      coalesce(sum(e.lost) FILTER (
        WHERE e.kind = 'loss' AND e.deployment = ${cohort.deploymentId}
          AND e.artifact = ${artifactDigest} AND e.behavior = ${query.behaviorId}
          AND e.revision = ${behaviorRevision}
      ), 0)::float8 AS "reportedLoss",
      min(e.event_id) FILTER (WHERE e.type = 'error' AND e.handled) AS "handledError",
      min(e.event_id) FILTER (WHERE e.type = 'step' AND e.step = ${query.fallbackStep}) AS fallback,
      min(e.event_id) FILTER (WHERE e.type IN ('completed', 'failed') AND e.outcome = ${query.partialOutcome}) AS "partialOutcome",
      CASE WHEN bool_or(e.type = 'completed' AND e.outcome IS DISTINCT FROM ${query.partialOutcome})
        AND NOT coalesce(bool_or(e.type = 'failed'), false)
        THEN min(e.event_id) FILTER (WHERE e.type = 'step' AND e.step = ${query.normalStep})
      END AS "normalPath"
    FROM runs r LEFT JOIN events e ON e.run_id = r.id
    WHERE (SELECT count(*) FROM events) <= ${BEHAVIOR_COMPARISON_EVENT_CAP}
    GROUP BY r.id
  )
  SELECT (SELECT count(*) FROM runs) > ${EXECUTION_SEARCH_RUN_CAP}
      OR (SELECT count(*) FROM events) > ${BEHAVIOR_COMPARISON_EVENT_CAP} AS exceeded,
    coalesce((SELECT jsonb_agg(classified ORDER BY "runId") FROM classified), '[]'::jsonb) AS rows
`
