import { sql, type SQL } from "drizzle-orm"
import { Array, Effect } from "effect"
import { Database, DatabaseError } from "../database.js"
import { DatabaseOperation } from "../database-operation.js"
import { runQuery } from "../run-query.js"
import type { DatabaseTransaction } from "../run-transaction.js"

export const activeProjectOwners = (projectId: SQL) =>
  sql`NOT EXISTS (SELECT 1 FROM project_members m JOIN "user" u ON u.id = m.user_id WHERE m.project_id = ${projectId} AND u.lifecycle_operation_id IS NOT NULL)`

/** User admission precedes project locks; account confirmation holds this conflict. */
export const lockActiveProjectOwners = Effect.fn("lockActiveProjectOwners")(
  function* (tx: DatabaseTransaction, projectId: string) {
    const owners = yield* runQuery(DatabaseOperation.ProjectReadFence, () =>
      tx.execute<{ pending: string | null }>(
        sql`SELECT u.lifecycle_operation_id AS pending FROM "user" u JOIN project_members m ON m.user_id = u.id WHERE m.project_id = ${projectId}::uuid ORDER BY u.id FOR SHARE OF u`,
      ),
    )
    if (Array.some(owners, (owner) => owner.pending !== null)) {
      return yield* new DatabaseError({
        operation: DatabaseOperation.ProjectReadFence,
        cause: "Account cleanup in progress.",
      })
    }
  },
)

export const isAccountActive = Effect.fn("isAccountActive")(function* (
  userId: string,
) {
  const db = yield* Database
  const [row] = yield* runQuery(DatabaseOperation.DataLifecycle, () =>
    db.execute<{ active: boolean }>(
      sql`SELECT lifecycle_operation_id IS NULL AS active FROM "user" WHERE id = ${userId}`,
    ),
  )
  return row?.active === true
})
