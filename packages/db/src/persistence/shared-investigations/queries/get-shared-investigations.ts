import { sql } from "drizzle-orm"
import { Array, Effect } from "effect"
import { Database } from "../../database.js"
import { runQuery } from "../../run-query.js"
import { DatabaseOperation } from "../../database-operation.js"
import {
  SharedInvestigationRejected,
  type SharedInvestigationRow,
} from "../types.js"
export const getSharedInvestigations = Effect.fn("getSharedInvestigations")(
  function* (projectId: string) {
    const db = yield* Database
    const rows = yield* runQuery(DatabaseOperation.SharedInvestigations, () =>
      db.execute<SharedInvestigationRow & Record<string, unknown>>(sql`
    SELECT s.id,s.creator_id AS "creatorId",s.title,s.selection,s.created_at::text AS "createdAt"
    FROM shared_investigations s JOIN project_members m ON m.project_id=s.project_id AND m.user_id=s.creator_id
    JOIN "user" u ON u.id=s.creator_id
    WHERE s.project_id=${projectId}::uuid AND u.lifecycle_operation_id IS NULL
    ORDER BY s.created_at DESC,s.id DESC LIMIT 101 FOR SHARE OF s,m`),
    )
    if (rows.length > 100) {
      return yield* new SharedInvestigationRejected({ reason: "Unavailable" })
    }
    return Array.fromIterable(rows)
  },
)
