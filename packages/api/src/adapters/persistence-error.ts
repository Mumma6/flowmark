import type {
  DatabaseError,
  InvalidResultQuery,
  MissingRunError,
} from "@flowmark/db/persistence"
import { Effect } from "effect"
import { InvalidInput, PersistenceError, RunNotFound } from "../errors.js"

export const toPersistenceError = (error: DatabaseError) =>
  new PersistenceError({
    operation: error.operation,
    cause: error.cause,
  })

export const toInvalidInput = (error: InvalidResultQuery) =>
  new InvalidInput({ cause: error.message })

export const toRunNotFound = (error: MissingRunError) =>
  new RunNotFound({ runId: error.runId })

export const persist = <A, R>(effect: Effect.Effect<A, DatabaseError, R>) =>
  effect.pipe(Effect.mapError(toPersistenceError))
