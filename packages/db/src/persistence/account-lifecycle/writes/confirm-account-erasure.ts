import { and, eq, sql } from "drizzle-orm"
import { Effect } from "effect"
import { accountLifecycleOperations } from "../../../schema/account-lifecycle.js"
import { user } from "../../../schema/auth.js"
import { Database } from "../../database.js"
import { DatabaseOperation } from "../../database-operation.js"
import { runTransaction } from "../../run-transaction.js"
import {
  lifecycleDeadline,
  lifecycleQuery,
} from "../../data-lifecycle/access.js"
import { getAccountErasureCounts } from "../queries/get-account-erasure-counts.js"
import { AccountLifecycleRejected } from "../types.js"

export const confirmAccountErasure = Effect.fn("confirmAccountErasure")(
  function* (userId: string, operationId: string, confirmation: string) {
    const db = yield* Database
    return yield* runTransaction(
      DatabaseOperation.DataLifecycle,
      (use) => db.transaction(use),
      (tx) =>
        Effect.gen(function* () {
          yield* lifecycleQuery(() =>
            tx.execute(sql`SET LOCAL statement_timeout = '5s'`),
          )
          yield* lifecycleQuery(() =>
            tx.execute(sql`SET LOCAL lock_timeout = '3s'`),
          )
          const [identity] = yield* lifecycleQuery(() =>
            tx
              .select({ pending: user.lifecycleOperationId })
              .from(user)
              .where(eq(user.id, userId))
              .for("update"),
          )
          const [operation] = yield* lifecycleQuery(() =>
            tx
              .select()
              .from(accountLifecycleOperations)
              .where(
                and(
                  eq(accountLifecycleOperations.id, operationId),
                  eq(accountLifecycleOperations.userId, userId),
                ),
              )
              .for("update"),
          )
          if (!identity || !operation) {
            return yield* new AccountLifecycleRejected({
              reason: "Unauthorized",
            })
          }
          if (operation.contractVersion !== 1) {
            return yield* new AccountLifecycleRejected({
              reason: "UnsupportedVersion",
            })
          }
          if (identity.pending) {
            return yield* new AccountLifecycleRejected({
              reason: "Unavailable",
            })
          }
          if (confirmation !== "DELETE MY ACCOUNT") {
            return yield* new AccountLifecycleRejected({
              reason: "ConfirmationRequired",
            })
          }
          if (
            operation.state !== "previewed" ||
            operation.expiresAt.getTime() <= Date.now()
          ) {
            return yield* new AccountLifecycleRejected({
              reason: "StalePreview",
            })
          }
          const counts = yield* getAccountErasureCounts(tx, userId)
          if (counts.sharedProjects > 0) {
            return yield* new AccountLifecycleRejected({
              reason: "SharedProject",
            })
          }
          if (
            counts.revision !== operation.counts.revision ||
            counts.unfinishedProjects > 0
          ) {
            return yield* new AccountLifecycleRejected({
              reason: "StalePreview",
            })
          }
          yield* lifecycleQuery(() =>
            tx
              .update(user)
              .set({ lifecycleOperationId: operationId })
              .where(eq(user.id, userId)),
          )
          const [confirmed] = yield* lifecycleQuery(() =>
            tx
              .update(accountLifecycleOperations)
              .set({
                state: "purging",
                counts: { ...counts, previewProjects: [], revision: "" },
                capabilityExpiresAt: new Date(Date.now() + 86400_000),
                expiresAt: new Date(Date.now() + 30 * 86400_000),
              })
              .where(eq(accountLifecycleOperations.id, operationId))
              .returning(),
          )
          return confirmed
        }),
    ).pipe(lifecycleDeadline)
  },
)
