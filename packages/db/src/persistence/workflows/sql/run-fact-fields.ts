import { sql } from "drizzle-orm"

/** Shared with the migration projection; raw fallback is only for unbackfilled runs. */
export const rawRunFactFields = sql`
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
`
