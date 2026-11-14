import { Effect } from "effect"
import { Database } from "../../database.js"
import { DatabaseOperation } from "../../database-operation.js"
import { runTransaction } from "../../run-transaction.js"
import { readCleanupCapability } from "../capability.js"

export const getAccountErasureStatus = Effect.fn("getAccountErasureStatus")(
  function* (operationId: string, capability: string) {
    const db = yield* Database
    return yield* runTransaction(
      DatabaseOperation.DataLifecycle,
      (use) => db.transaction(use),
      (tx) => readCleanupCapability(tx, operationId, capability),
    )
  },
)
