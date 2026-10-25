import { Effect, Layer, Redacted } from "effect"
import { createDatabase } from "@flowmark/db"
import { Database, DatabaseError } from "@flowmark/db/store"
import { ApiSettings } from "../config.js"

export const DatabaseLive = Layer.scoped(
  Database,
  Effect.gen(function* () {
    const settings = yield* ApiSettings
    const connection = yield* Effect.acquireRelease(
      Effect.try({
        try: () => createDatabase(Redacted.value(settings.databaseUrl)),
        catch: (cause) => new DatabaseError({ operation: "connect", cause }),
      }),
      ({ close }) =>
        Effect.tryPromise({
          try: close,
          catch: (cause) => new DatabaseError({ operation: "close", cause }),
        }).pipe(Effect.orDie),
    )
    return connection.db
  }),
)
