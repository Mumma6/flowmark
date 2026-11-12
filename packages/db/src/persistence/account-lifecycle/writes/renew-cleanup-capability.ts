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
import { AccountLifecycleRejected } from "../types.js"

/** Privileged operator boundary only. Deliberately absent from API ports/routes.
 * Independently verify the requester and approve the exact database/immutable IDs
 * before calling. It rotates a recovery secret; scope and the account lock stay fixed.
 */
export const renewCleanupCapability = Effect.fn("renewCleanupCapability")(
  function* (operationId: string, immutableUserId: string) {
    const db = yield* Database
    const capability = yield* Effect.sync(() =>
      randomBytes(32).toString("base64url"),
    )
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
          const [operation] = yield* lifecycleQuery(() =>
            tx
              .select({ id: accountLifecycleOperations.id })
              .from(accountLifecycleOperations)
              .innerJoin(
                user,
                and(
                  eq(user.id, accountLifecycleOperations.userId),
                  eq(user.lifecycleOperationId, accountLifecycleOperations.id),
                ),
              )
              .where(
                and(
                  eq(accountLifecycleOperations.id, operationId),
                  eq(accountLifecycleOperations.userId, immutableUserId),
                  eq(accountLifecycleOperations.state, "purging"),
                  eq(accountLifecycleOperations.contractVersion, 1),
                ),
              )
              .for("update"),
          )
          if (!operation) {
            return yield* new AccountLifecycleRejected({
              reason: "Unauthorized",
            })
          }
          yield* lifecycleQuery(() =>
            tx
              .update(accountLifecycleOperations)
              .set({
                capabilityHash: hashApiKey(capability),
                capabilityExpiresAt: new Date(Date.now() + 86400_000),
              })
              .where(eq(accountLifecycleOperations.id, operationId)),
          )
          return { operationId, capability }
        }),
    ).pipe(lifecycleDeadline)
  },
)
