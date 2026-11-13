import { expiredCapture } from "../sql/lifetime.js"
import { sql } from "drizzle-orm"
import { Effect } from "effect"
import { Database, DatabaseError } from "../../database.js"
import { DatabaseOperation } from "../../database-operation.js"
import { runQuery } from "../../run-query.js"
/** One stateless, resumable batch under the existing project lifecycle fence. */
export const purgeExpiredCaptures = Effect.fn("purgeExpiredCaptures")(
  function* (projectId: string) {
    const db = yield* Database
    const [result] = yield* runQuery(DatabaseOperation.EvidenceCaptures, () =>
      db.execute<{ deleted: number; hasMore: boolean }>(sql`
 WITH expired AS MATERIALIZED (
 SELECT c.id FROM evidence_captures c JOIN workflow_runs r ON r.id=c.source_run_id JOIN workflows w ON w.id=r.workflow_id
 WHERE c.project_id=${projectId}::uuid AND w.project_id=c.project_id
 AND ${expiredCapture}
 ORDER BY c.expires_at,c.id LIMIT 26
 ), removed AS (DELETE FROM evidence_captures WHERE project_id=${projectId}::uuid AND id IN (SELECT id FROM expired LIMIT 25) RETURNING id)
 SELECT (SELECT count(*)::int FROM removed) AS deleted,(SELECT count(*)>25 FROM expired) AS "hasMore"`),
    )
    // An aggregate query always returns one row; absence is a failed operation.
    if (!result) {
      return yield* new DatabaseError({
        operation: DatabaseOperation.EvidenceCaptures,
        cause: "Missing cleanup result",
      })
    }
    return result
  },
)
