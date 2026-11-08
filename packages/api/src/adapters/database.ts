import { Effect, Layer, Redacted } from "effect"
import { createDatabase } from "@flowmark/db"
import {
  Database,
  DatabaseError,
  DatabaseOperation,
  DatabaseReadBudget,
} from "@flowmark/db/persistence"
import { ApiSettings } from "../config.js"
export const DatabaseLive = Layer.effect(
  Database,
  Effect.gen(function* () {
    const settings = yield* ApiSettings
    const budget = yield* DatabaseReadBudget
    const cancellation = yield* Effect.sync(() => new AbortController())
    const connection = yield* Effect.acquireRelease(
      Effect.try({
        try: () =>
          createDatabase(Redacted.value(settings.databaseUrl), {
            signal: cancellation.signal,
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
    yield* Effect.addFinalizer(() => Effect.sync(() => cancellation.abort()))
    return connection.db
  }),
)
