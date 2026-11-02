import type { DatabaseError } from "@flowmark/db/persistence"
import { Effect } from "effect"
import { PersistenceError } from "../errors.js"

export const toPersistenceError = (error: {
  readonly operation: string
  readonly cause: unknown
}) =>
  new PersistenceError({
    operation: error.operation,
    cause: error.cause,
  })

export const persist = <A, R>(effect: Effect.Effect<A, DatabaseError, R>) =>
  effect.pipe(Effect.mapError(toPersistenceError))
