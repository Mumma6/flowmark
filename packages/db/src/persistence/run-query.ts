import { Effect } from "effect"
import { DatabaseError } from "./database.js"
import { DatabaseOperation } from "./database-operation.js"

export const runQuery = <A>(
  operation: DatabaseOperation,
  query: () => Promise<A>,
) =>
  Effect.tryPromise({
    try: query,
    catch: (cause) => new DatabaseError({ operation, cause }),
  })
