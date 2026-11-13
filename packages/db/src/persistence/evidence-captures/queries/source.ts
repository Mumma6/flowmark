import { sql } from "drizzle-orm"
import { Effect } from "effect"
import { Database } from "../../database.js"
import { runQuery } from "../../run-query.js"
import { DatabaseOperation } from "../../database-operation.js"
import { projectRunSummaries } from "../../workflows/sql/run-summaries.js"
import type { StoredRun } from "../../workflows/types.js"
import { EvidenceCaptureRejected } from "../types.js"
export const captureSource = Effect.fn("captureSource")(function* (
  projectId: string,
  runId: string,
) {
  const db = yield* Database
  const [locked] = yield* runQuery(DatabaseOperation.EvidenceCaptures, () =>
    db.execute(
      sql`SELECT r.id FROM workflow_runs r JOIN workflows w ON w.id=r.workflow_id WHERE r.id=${runId}::uuid AND w.project_id=${projectId}::uuid FOR SHARE OF r`,
    ),
  )
  if (!locked) {
    return yield* new EvidenceCaptureRejected({ reason: "Unavailable" })
  }
  const [source] = yield* runQuery(DatabaseOperation.EvidenceCaptures, () =>
    db.execute<
      Pick<
        StoredRun,
        "id" | "workflow" | "status" | "outcome" | "startedAt" | "durationMs"
      > & {
        definitionRevision: string | null
        capturedAt: string
        expiresAt: string
      }
    >(
      sql`${projectRunSummaries(projectId, { runId })}, observed AS MATERIALIZED (SELECT date_trunc('milliseconds',clock_timestamp()) AS at) SELECT s.id,s.workflow,s.status,s.outcome,s."startedAt"::text AS "startedAt",s."durationMs",s."definitionRevision",o.at::text AS "capturedAt",date_trunc('milliseconds',LEAST(o.at+interval '24 hours',r.started_at+interval '30 days',r.created_at+interval '30 days'))::text AS "expiresAt" FROM runs s JOIN workflow_runs r ON r.id=s.id CROSS JOIN observed o`,
    ),
  )
  if (
    !source ||
    Date.parse(source.expiresAt) <= Date.parse(source.capturedAt)
  ) {
    return yield* new EvidenceCaptureRejected({ reason: "Unavailable" })
  }
  return { ...source, outcome: source.outcome ?? null }
})
/** Only selected leaves cross the database boundary, with a bound before aggregation. */
export const captureValues = Effect.fn("captureValues")(function* (
  projectId: string,
  runId: string,
  paths: readonly (readonly string[])[],
  keys: readonly string[],
) {
  const db = yield* Database
  const [row] = yield* runQuery(DatabaseOperation.EvidenceCaptures, () =>
    db.execute<{
      oversized: boolean
      values: readonly unknown[] | null
      references: readonly { key: string; value: string }[] | null
    }>(sql`${projectRunSummaries(projectId, { runId })}, leaves AS (
 SELECT p.ordinality,s.result #> ARRAY(SELECT jsonb_array_elements_text(p.path)) AS value FROM runs s CROSS JOIN jsonb_array_elements(${JSON.stringify(paths)}::jsonb) WITH ORDINALITY p(path,ordinality)
 ), refs AS (
 SELECT k.key,r.properties->>k.key AS value FROM workflow_runs r CROSS JOIN jsonb_array_elements_text(${JSON.stringify(keys)}::jsonb) k(key) WHERE r.id=${runId}::uuid AND jsonb_typeof(r.properties->k.key)='string' AND length(r.properties->>k.key) BETWEEN 1 AND 256
 ), bounds AS (SELECT COALESCE((SELECT sum(octet_length(value::text)) FROM leaves),0)+COALESCE((SELECT sum(octet_length(value)) FROM refs),0)>65536 AS oversized)
 SELECT oversized,CASE WHEN oversized THEN NULL ELSE COALESCE((SELECT jsonb_agg(value ORDER BY ordinality) FROM leaves),'[]'::jsonb) END AS values,CASE WHEN oversized THEN NULL ELSE COALESCE((SELECT jsonb_agg(jsonb_build_object('key',key,'value',value)) FROM refs),'[]'::jsonb) END AS references FROM bounds`),
  )
  if (!row || row.oversized) {
    return yield* new EvidenceCaptureRejected({ reason: "Oversized" })
  }
  return { values: row.values ?? [], references: row.references ?? [] }
})
