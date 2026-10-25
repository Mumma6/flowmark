import { Effect } from "effect"
import { createDatabase, type FlowmarkDatabase } from "../client.js"
import { DatabaseError } from "../persistence/database.js"
import { DatabaseOperation } from "../persistence/database-operation.js"

export const withCommandDatabase = <A, E>(
  url: string,
  use: (db: FlowmarkDatabase) => Effect.Effect<A, E>,
) =>
  Effect.scoped(
    Effect.gen(function* () {
      const connection = yield* Effect.acquireRelease(
        Effect.try({
          try: () => createDatabase(url),
          catch: (cause) =>
            new DatabaseError({ operation: DatabaseOperation.Connect, cause }),
        }),
        ({ close }) =>
          Effect.tryPromise({
            try: close,
            catch: (cause) =>
              new DatabaseError({ operation: DatabaseOperation.Close, cause }),
          }).pipe(Effect.orDie),
      )
      return yield* use(connection.db)
    }),
  )
