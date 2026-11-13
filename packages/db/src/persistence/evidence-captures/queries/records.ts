import { sql } from "drizzle-orm"
import { Effect } from "effect"
import { Database } from "../../database.js"
import { runQuery } from "../../run-query.js"
import { DatabaseOperation } from "../../database-operation.js"
import type { CaptureMetadata } from "../types.js"
export const captureRecords = Effect.fn("captureRecords")(function* (
  projectId: string,
  revision: number,
) {
  const db = yield* Database
  return yield* runQuery(DatabaseOperation.EvidenceCaptures, () =>
    db.execute<CaptureMetadata & Record<string, unknown>>(sql`
 SELECT c.id,c.source_run_id AS "sourceRunId",c.creator_id AS "creatorId",c.captured_at::text AS "capturedAt",c.expires_at::text AS "expiresAt",CASE
 WHEN r.id IS NULL OR w.project_id IS DISTINCT FROM c.project_id THEN 'SourceMissing'
 WHEN clock_timestamp()>=LEAST(c.expires_at,r.started_at+interval '30 days',r.created_at+interval '30 days') THEN 'Expired'
 WHEN c.publication_revision<>${revision} THEN 'PublicationChanged' ELSE NULL END AS reason
 FROM evidence_captures c JOIN project_members m ON m.user_id=c.creator_id AND m.project_id=c.project_id
 JOIN "user" u ON u.id=c.creator_id AND u.lifecycle_operation_id IS NULL
 LEFT JOIN workflow_runs r ON r.id=c.source_run_id LEFT JOIN workflows w ON w.id=r.workflow_id
 WHERE c.project_id=${projectId}::uuid ORDER BY c.captured_at DESC,c.id DESC LIMIT 100 FOR SHARE OF c,m`),
  )
})
export const capturePayload = Effect.fn("capturePayload")(function* (
  projectId: string,
  id: string,
  revision: number,
) {
  const db = yield* Database
  const [row] = yield* runQuery(DatabaseOperation.EvidenceCaptures, () =>
    db.execute<{ payload: unknown }>(
      sql`SELECT c.payload FROM evidence_captures c JOIN "user" u ON u.id=c.creator_id AND u.lifecycle_operation_id IS NULL JOIN project_members m ON m.project_id=c.project_id AND m.user_id=c.creator_id JOIN workflow_runs r ON r.id=c.source_run_id JOIN workflows w ON w.id=r.workflow_id WHERE c.project_id=${projectId}::uuid AND c.id=${id}::uuid AND w.project_id=c.project_id AND c.publication_revision=${revision} AND clock_timestamp()<LEAST(c.expires_at,r.started_at+interval '30 days',r.created_at+interval '30 days')`,
    ),
  )
  return row?.payload
})
