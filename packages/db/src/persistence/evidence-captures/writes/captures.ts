import { sql } from "drizzle-orm"
import { Effect } from "effect"
import type { CapturedRunEvidence } from "@flowmarkdev/core"
import { Database } from "../../database.js"
import { runQuery } from "../../run-query.js"
import { DatabaseOperation } from "../../database-operation.js"
import { EvidenceCaptureRejected } from "../types.js"
export const insertCapture = Effect.fn("insertCapture")(function* (
  projectId: string,
  userId: string,
  capture: CapturedRunEvidence,
) {
  const db = yield* Database
  const [limits] = yield* runQuery(DatabaseOperation.EvidenceCaptures, () =>
    db.execute<{ total: number; own: number; bytes: number }>(
      sql`SELECT count(*)::int AS total,count(*) FILTER (WHERE creator_id=${userId})::int AS own,octet_length(${JSON.stringify(capture)}::jsonb::text) AS bytes FROM evidence_captures WHERE project_id=${projectId}::uuid`,
    ),
  )
  if (!limits || limits.total >= 100 || limits.own >= 20) {
    return yield* new EvidenceCaptureRejected({ reason: "Limit" })
  }
  if (limits.bytes > 65536) {
    return yield* new EvidenceCaptureRejected({ reason: "Oversized" })
  }
  yield* runQuery(DatabaseOperation.EvidenceCaptures, () =>
    db.execute(
      sql`INSERT INTO evidence_captures(id,creator_id,project_id,source_run_id,publication_revision,captured_at,expires_at,payload) VALUES(${capture.id}::uuid,${userId},${projectId}::uuid,${capture.sourceRunId}::uuid,${capture.evidence.projection.publicationRevision},${capture.capturedAt}::timestamptz,${capture.expiresAt}::timestamptz,${JSON.stringify(capture)}::jsonb)`,
    ),
  )
  return { id: capture.id }
})
export const deleteCapture = Effect.fn("deleteCapture")(function* (
  projectId: string,
  userId: string,
  owner: boolean,
  id: string,
) {
  const db = yield* Database
  const [row] = yield* runQuery(DatabaseOperation.EvidenceCaptures, () =>
    db.execute(
      sql`DELETE FROM evidence_captures WHERE project_id=${projectId}::uuid AND id=${id}::uuid AND (creator_id=${userId} OR ${owner}) RETURNING id`,
    ),
  )
  if (!row) {
    return yield* new EvidenceCaptureRejected({ reason: "Unavailable" })
  }
  return { deleted: true as const }
})
