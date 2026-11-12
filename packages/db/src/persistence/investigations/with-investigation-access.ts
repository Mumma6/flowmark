import { and, eq, sql } from "drizzle-orm"
import { Effect } from "effect"
import { projectMembers } from "../../schema/index.js"
import { Database } from "../database.js"
import { DatabaseOperation } from "../database-operation.js"
import { runQuery } from "../run-query.js"
import { runTransaction, type DatabaseTransaction } from "../run-transaction.js"
import { InvestigationRejected } from "./investigation-error.js"

/** Hold membership through the operation; serialize creates to enforce the owner cap. */
export const withInvestigationAccess = Effect.fn("withInvestigationAccess")(
  function* <A, E>(
    userId: string,
    projectId: string,
    operation: DatabaseOperation,
    use: (tx: DatabaseTransaction) => Effect.Effect<A, E>,
    serializeCreate = false,
  ) {
    const db = yield* Database
    return yield* runTransaction(
      operation,
      (body) => db.transaction(body),
      (tx) =>
        Effect.gen(function* () {
          const membership = yield* runQuery(operation, () =>
            tx
              .select({ userId: projectMembers.userId })
              .from(projectMembers)
              .where(
                and(
                  eq(projectMembers.userId, userId),
                  eq(projectMembers.projectId, projectId),
                ),
              )
              .limit(1)
              .for("share"),
          )
          if (membership.length === 0) {
            return yield* new InvestigationRejected({ reason: "Unauthorized" })
          }
          if (serializeCreate) {
            yield* runQuery(operation, () =>
              tx.execute(
                sql`SELECT pg_advisory_xact_lock(hashtextextended(${JSON.stringify(["private-investigations", userId, projectId])}, 0))`,
              ),
            )
          }
          return yield* use(tx)
        }),
    )
  },
)
