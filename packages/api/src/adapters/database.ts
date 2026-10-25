import { Effect, Layer, Redacted } from "effect"
import { createDatabase } from "@flowmark/db"
import {
  Database,
  DatabaseError,
  DatabaseOperation,
} from "@flowmark/db/persistence"
import { ApiSettings } from "../config.js"

export const DatabaseLive = Layer.scoped(
  Database,
  Effect.gen(function* () {
    const settings = yield* ApiSettings
    const connection = yield* Effect.acquireRelease(
      Effect.try({
        try: () => createDatabase(Redacted.value(settings.databaseUrl)),
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
    return connection.db
  }),
)
