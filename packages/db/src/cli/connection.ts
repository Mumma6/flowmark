import { Effect } from "effect"
import { createDatabase, type FlowmarkDatabase } from "../client.js"
import { DatabaseError } from "../persistence/database.js"
import { DatabaseOperation } from "../persistence/database-operation.js"

export const withCommandDatabase = <A, E>(
  url: string,
  use: (db: FlowmarkDatabase) => Effect.Effect<A, E>,
  options: { readonly prepare?: boolean } = {},
) =>
  Effect.scoped(
    Effect.gen(function* () {
      const connection = yield* Effect.acquireRelease(
        Effect.try({
          try: () => createDatabase(url, options),
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
