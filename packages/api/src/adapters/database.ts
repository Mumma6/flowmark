import { Context, Effect, Layer, Redacted } from "effect"
import { createDatabase } from "@flowmark/db"
import {
  Database,
  DatabaseCancellation,
  DatabaseError,
  DatabaseOperation,
  DatabaseReadBudget,
} from "@flowmark/db/persistence"
import { ApiSettings } from "../config.js"
export const DatabaseLive = Layer.effectContext(
  Effect.gen(function* () {
    const settings = yield* ApiSettings
    const budget = yield* DatabaseReadBudget
    const connection = yield* Effect.acquireRelease(
      Effect.try({
        try: () =>
          createDatabase(Redacted.value(settings.databaseUrl), {
            statementTimeoutMs: budget.statementTimeoutMs,
          }),
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
    // Abort pending driver queries before closing the pool (finalizers run LIFO).
    yield* Effect.addFinalizer(() => Effect.sync(connection.cancel))
    return Context.make(Database, connection.db).pipe(
      Context.add(DatabaseCancellation, connection.cancel),
    )
  }),
)
