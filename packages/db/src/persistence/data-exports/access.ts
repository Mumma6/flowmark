import { and, eq, sql } from "drizzle-orm"
import { Effect } from "effect"
import { dataExportRequests } from "../../schema/data-exports.js"
import { Database, DatabaseError } from "../database.js"
import { DatabaseOperation } from "../database-operation.js"
import { runQuery } from "../run-query.js"
import { runTransaction, type DatabaseTransaction } from "../run-transaction.js"
import { lockActiveProjectOwners } from "../account-lifecycle/active-account.js"
import { DataExportRejected } from "./types.js"
export const query = <A>(use: () => Promise<A>) =>
  runQuery(DatabaseOperation.DataExport, use)
export const authorize = Effect.fn("DataExport.authorize")(function* (
  tx: DatabaseTransaction,
  userId: string,
  sessionId: string,
  projectId: string | null,
) {
  // Lock account before project, matching the existing lifecycle and membership writers.
  const [identity] = yield* query(() =>
    tx.execute(
      sql`SELECT u.id FROM "user" u JOIN session s ON s.user_id=u.id WHERE u.id=${userId} AND u.lifecycle_operation_id IS NULL AND s.id=${sessionId} AND s.expires_at>now() FOR SHARE OF u, s`,
    ),
  )
  if (!identity) {
    return yield* new DataExportRejected({ reason: "Unavailable" })
  }
  if (projectId !== null) {
    yield* lockActiveProjectOwners(tx, projectId, userId)
    const [project] = yield* query(() =>
      tx.execute(
        sql`SELECT p.id FROM projects p JOIN project_members m ON m.project_id=p.id WHERE p.id=${projectId}::uuid AND p.lifecycle_operation_id IS NULL AND m.user_id=${userId} AND m.role='owner' FOR SHARE OF p, m`,
      ),
    )
    if (!project) {
      return yield* new DataExportRejected({ reason: "Unavailable" })
    }
  }
})
export const operationView = (row: typeof dataExportRequests.$inferSelect) => ({
  id: row.id,
  projectId: row.projectId,
  state: row.state,
  cutoff: row.createdAt.toISOString(),
  expiresAt: row.expiresAt.toISOString(),
  cursor: row.previousToken ?? row.token,
  part: row.previousPosition?.part ?? row.position.part,
})

export const load = Effect.fn("DataExports.load")(function* (
  tx: DatabaseTransaction,
  userId: string,
  sessionId: string,
  id: string,
) {
  const predicate = and(
    eq(dataExportRequests.id, id),
    eq(dataExportRequests.userId, userId),
    eq(dataExportRequests.sessionId, sessionId),
  )
  const [target] = yield* query(() =>
    tx
      .select({ projectId: dataExportRequests.projectId })
      .from(dataExportRequests)
      .where(predicate),
  )
  if (!target) {
    return yield* new DataExportRejected({ reason: "Unavailable" })
  }
  yield* authorize(tx, userId, sessionId, target.projectId)
  const [row] = yield* query(() =>
    tx.select().from(dataExportRequests).where(predicate).for("update"),
  )
  if (
    !row ||
    row.version !== 1 ||
    row.state === "cancelled" ||
    row.expiresAt.getTime() <= Date.now()
  ) {
    return yield* new DataExportRejected({ reason: "Unavailable" })
  }
  return row
})
export const transaction = <A, E>(
  use: (tx: DatabaseTransaction) => Effect.Effect<A, E>,
) =>
  Effect.gen(function* () {
    const db = yield* Database
    return yield* runTransaction(
      DatabaseOperation.DataExport,
      (fn) => db.transaction(fn),
      (tx) =>
        Effect.gen(function* () {
          yield* query(() => tx.execute(sql`SET LOCAL statement_timeout='5s'`))
          yield* query(() => tx.execute(sql`SET LOCAL lock_timeout='3s'`))
          return yield* use(tx)
        }),
    )
  }).pipe(
    Effect.timeout("10 seconds"),
    Effect.catchTag("TimeoutError", (cause) =>
      Effect.fail(
        new DatabaseError({ operation: DatabaseOperation.DataExport, cause }),
      ),
    ),
  )
