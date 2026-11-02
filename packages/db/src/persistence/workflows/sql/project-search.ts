import { sql } from "drizzle-orm"

export const searchWorkflowNamesSql = (
  projectId: string,
  pattern: string,
  limit: number,
) => sql`
  SELECT name
  FROM workflows
  WHERE project_id = ${projectId}
    AND name ILIKE ${pattern} ESCAPE '\\'
  ORDER BY name
  LIMIT ${limit}
`

/** Exact matches on enabled lookup keys and allowed dimension values. */
export const searchBusinessReferencesSql = (
  projectId: string,
  value: string,
  limit: number,
) => sql`
  SELECT
    r.id AS "runId",
    r.external_id AS "externalId",
    w.name AS workflow,
    field ->> 'key' AS "key",
    r.properties ->> (field ->> 'key') AS "value"
  FROM workflow_runs r
  JOIN workflows w ON w.id = r.workflow_id
  JOIN workflow_search_fields config
    ON config.project_id = w.project_id
   AND config.workflow = w.name
  CROSS JOIN LATERAL jsonb_array_elements(config.fields) AS field
  WHERE w.project_id = ${projectId}
    AND jsonb_typeof(r.properties -> (field ->> 'key')) = 'string'
    AND r.properties @> jsonb_build_object(field ->> 'key', ${value}::text)
    AND (
      field ->> 'role' = 'lookup'
      OR (
        field ->> 'role' = 'dimension'
        AND (field -> 'values') ? ${value}
      )
    )
  ORDER BY r.started_at DESC, r.id DESC, field ->> 'key'
  LIMIT ${limit}
`
