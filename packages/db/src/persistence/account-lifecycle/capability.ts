import { and, eq, gt, inArray } from "drizzle-orm"
import { Effect } from "effect"
import { accountLifecycleOperations } from "../../schema/account-lifecycle.js"
import { hashApiKey } from "../database.js"
import { lifecycleQuery } from "../data-lifecycle/access.js"
import type { DatabaseTransaction } from "../run-transaction.js"
import { AccountLifecycleRejected } from "./types.js"

export const readCleanupCapability = Effect.fn("readCleanupCapability")(
  function* (
    tx: DatabaseTransaction,
    operationId: string,
    capability: string,
    lock = false,
  ) {
    const selection = tx
      .select()
      .from(accountLifecycleOperations)
      .where(
        and(
          eq(accountLifecycleOperations.id, operationId),
          eq(accountLifecycleOperations.capabilityHash, hashApiKey(capability)),
          gt(accountLifecycleOperations.capabilityExpiresAt, new Date()),
          inArray(accountLifecycleOperations.state, [
            "purging",
            "live_data_deleted",
          ]),
        ),
      )
    const [operation] = yield* lifecycleQuery(() =>
      lock ? selection.for("update") : selection,
    )
    if (!operation) {
      return yield* new AccountLifecycleRejected({
        reason: "InvalidCapability",
      })
    }
    if (operation.contractVersion !== 1) {
      return yield* new AccountLifecycleRejected({
        reason: "UnsupportedVersion",
      })
    }
    return operation
  },
)
