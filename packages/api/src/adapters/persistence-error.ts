import { PersistenceError } from "../errors.js"

export const toPersistenceError = (error: {
  readonly operation: string
  readonly cause: unknown
}) =>
  new PersistenceError({
    operation: error.operation,
    cause: error.cause,
  })
