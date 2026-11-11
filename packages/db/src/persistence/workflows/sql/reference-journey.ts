import { Array } from "effect"
import { sql } from "drizzle-orm"
import type { ReferenceJourneyQuery } from "@flowmarkdev/core"

/** GIN-compatible exact lookup; each workflow must explicitly permit this key. */
const eligible = (projectId: string, query: ReferenceJourneyQuery) => sql`
  FROM workflow_runs r JOIN workflows w ON w.id = r.workflow_id
  JOIN (VALUES ${sql.join(
    Array.map(
      query.namespaces,
      (namespace) => sql`(${namespace.workflow}::text, ${namespace.key}::text)`,
    ),
    sql`, `,
  )}) AS ns(workflow, key) ON ns.workflow = w.name
  JOIN workflow_search_fields config ON config.project_id = w.project_id AND config.workflow = w.name
  WHERE w.project_id = ${projectId}
    AND config.fields @> jsonb_build_array(jsonb_build_object('key', ns.key, 'role', 'lookup'))
    AND jsonb_typeof(r.properties -> ns.key) = 'string'
    AND r.properties @> jsonb_build_object(ns.key, ${query.value}::text)
`
const selection = sql`r.id, r.external_id AS "externalId", w.name AS workflow,
  to_char(r.started_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "startedAt"`
const ids = (values: readonly string[]) =>
  sql`ARRAY[${sql.join(
    Array.map(values, (id) => sql`${id}::uuid`),
    sql`, `,
  )}]::uuid[]`

export const journeyAnchorsSql = (
  projectId: string,
  query: ReferenceJourneyQuery,
  limit: number,
  after?: { startedAt: string; id: string },
) => sql`
  SELECT ${selection} ${eligible(projectId, query)} AND w.name = ${query.workflow}
    AND (${query.anchorRunId ?? null}::uuid IS NULL OR r.id = ${query.anchorRunId ?? null}::uuid)
    AND (${after?.id ?? null}::uuid IS NULL OR (r.started_at, r.id) > (${after?.startedAt ?? null}::timestamptz, ${after?.id ?? null}::uuid))
  ORDER BY r.started_at, r.id LIMIT ${limit}
`

/** Read only a bounded next frontier; ambiguous unqualified parent IDs are never traversed. */
export const journeyNeighborsSql = (
  projectId: string,
  query: ReferenceJourneyQuery,
  frontier: readonly string[],
  visited: readonly string[],
  limit: number,
) => sql`
  SELECT ${selection} ${eligible(projectId, query)}
    AND NOT (r.id = ANY(${ids(visited)}))
    AND EXISTS (
      SELECT 1 FROM workflow_runs f JOIN workflows fw ON fw.id = f.workflow_id
      WHERE fw.project_id = ${projectId} AND f.id = ANY(${ids(frontier)}) AND (
        (r.parent_run_id = f.external_id AND (
          SELECT count(*) FROM (SELECT p.id FROM workflow_runs p JOIN workflows pw ON pw.id = p.workflow_id
            WHERE pw.project_id = ${projectId} AND p.external_id = f.external_id LIMIT 2) matches
        ) = 1)
        OR (f.parent_run_id = r.external_id AND (
          SELECT count(*) FROM (SELECT p.id FROM workflow_runs p JOIN workflows pw ON pw.id = p.workflow_id
            WHERE pw.project_id = ${projectId} AND p.external_id = r.external_id LIMIT 2) matches
        ) = 1)
        OR (r.retry_of->>'workflow' = fw.name AND r.retry_of->>'runId' = f.external_id)
        OR (f.retry_of->>'workflow' = w.name AND f.retry_of->>'runId' = r.external_id)
      )
    ) ORDER BY r.started_at, r.id LIMIT ${limit}
`

/** Compact facts for at most 100 selected nodes; parent candidates stop at two. */
export const journeyEvidenceSql = (
  projectId: string,
  runIds: readonly string[],
) => sql`
  SELECT ${selection}, r.outcome,
    CASE WHEN EXISTS (SELECT 1 FROM workflow_events e WHERE e.run_id = r.id AND e.type = 'failed') THEN 'Failed'
      WHEN EXISTS (SELECT 1 FROM workflow_events e WHERE e.run_id = r.id AND e.type = 'completed') THEN 'Completed' ELSE 'Running' END AS status,
    r.parent_run_id AS "parentRunId", r.retry_of AS "retryOf",
    coalesce(parent_matches.items, '[]'::jsonb) AS parents,
    coalesce(retry_matches.items, '[]'::jsonb) AS retries
  FROM workflow_runs r JOIN workflows w ON w.id = r.workflow_id
  LEFT JOIN LATERAL (
    SELECT jsonb_agg(p ORDER BY p."startedAt", p.id) AS items FROM (
      SELECT p.id, p.external_id AS "externalId", pw.name AS workflow, p.started_at::text AS "startedAt"
      FROM workflow_runs p JOIN workflows pw ON pw.id = p.workflow_id
      WHERE pw.project_id = ${projectId} AND p.external_id = r.parent_run_id
      ORDER BY p.started_at, p.id LIMIT 2
    ) p
  ) parent_matches ON true
  LEFT JOIN LATERAL (
    SELECT jsonb_agg(p) AS items FROM (
      SELECT p.id, p.external_id AS "externalId", pw.name AS workflow, p.started_at::text AS "startedAt"
      FROM workflow_runs p JOIN workflows pw ON pw.id = p.workflow_id
      WHERE pw.project_id = ${projectId} AND pw.name = r.retry_of->>'workflow' AND p.external_id = r.retry_of->>'runId' LIMIT 1
    ) p
  ) retry_matches ON true
  WHERE w.project_id = ${projectId} AND r.id = ANY(${ids(runIds)})
`
