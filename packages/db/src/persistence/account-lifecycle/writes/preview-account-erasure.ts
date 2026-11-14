import { randomBytes } from "node:crypto"
import { and, eq, sql } from "drizzle-orm"
import { Effect } from "effect"
import { accountLifecycleOperations } from "../../../schema/account-lifecycle.js"
import { user } from "../../../schema/auth.js"
import { Database, hashApiKey } from "../../database.js"
import { DatabaseOperation } from "../../database-operation.js"
import { runTransaction } from "../../run-transaction.js"
import {
  lifecycleDeadline,
  lifecycleQuery,
} from "../../data-lifecycle/access.js"
import { getAccountErasureCounts } from "../queries/get-account-erasure-counts.js"
import { AccountLifecycleRejected } from "../types.js"

export const previewAccountErasure = Effect.fn("previewAccountErasure")(
  function* (userId: string) {
    const db = yield* Database
    const capability = yield* Effect.sync(() =>
      randomBytes(32).toString("base64url"),
    )
    const operation = yield* runTransaction(
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
          yield* lifecycleQuery(() =>
            tx.execute(
              sql`DELETE FROM account_lifecycle_operations WHERE id IN (SELECT id FROM account_lifecycle_operations WHERE expires_at <= now() AND state <> 'purging' ORDER BY expires_at LIMIT 100 FOR UPDATE SKIP LOCKED)`,
            ),
          )
          const [identity] = yield* lifecycleQuery(() =>
            tx
              .select({ pending: user.lifecycleOperationId })
              .from(user)
              .where(eq(user.id, userId))
              .for("update"),
          )
          if (!identity) {
            return yield* new AccountLifecycleRejected({
              reason: "Unauthorized",
            })
          }
          if (identity.pending) {
            return yield* new AccountLifecycleRejected({
              reason: "Unavailable",
            })
          }
          yield* lifecycleQuery(() =>
            tx
              .delete(accountLifecycleOperations)
              .where(
                and(
                  eq(accountLifecycleOperations.userId, userId),
                  eq(accountLifecycleOperations.state, "previewed"),
                ),
              ),
          )
          const counts = yield* getAccountErasureCounts(tx, userId)
          if (counts.sharedProjects > 0) {
            return yield* new AccountLifecycleRejected({
              reason: "SharedProject",
            })
          }
          if (counts.unfinishedProjects > 0) {
            return yield* new AccountLifecycleRejected({
              reason: "Unavailable",
            })
          }
          const expiresAt = new Date(Date.now() + 300_000)
          const [created] = yield* lifecycleQuery(() =>
            tx
              .insert(accountLifecycleOperations)
              .values({
                userId,
                counts,
                capabilityHash: hashApiKey(capability),
                capabilityExpiresAt: expiresAt,
                expiresAt,
              })
              .returning(),
          )
          return created
        }),
    ).pipe(lifecycleDeadline)
    return { operation, capability }
  },
)
