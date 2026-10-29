import { Cause, Exit, Match } from "effect"
import { DatabaseError, DatabaseOperation } from "@flowmark/db/persistence"
import { ConfigurationError, InvalidInput, PersistenceError } from "./errors.js"

const operations = new Set<string>([
  ...Object.values(DatabaseOperation),
  "auth-session",
])
const codes = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "ETIMEDOUT",
  "ENOTFOUND",
  "EAI_AGAIN",
  "28P01",
  "42P01",
  "53300",
  "57P03",
])

// Driver/Drizzle errors can contain SQL, bound values, URLs and credentials.
// Copy only known diagnostic labels; never serialize the original error tree.
function diagnosticCode(error: unknown): string | undefined {
  let current = error
  for (let depth = 0; depth < 8; depth++) {
    if (typeof current !== "object" || current === null) {
      return undefined
    }
    const value = current as {
      readonly code?: unknown
      readonly cause?: unknown
    }
    if (typeof value.code === "string" && codes.has(value.code)) {
      return value.code
    }
    current = value.cause
  }
  return undefined
}

const describeFailure = (error: unknown) => {
  const code = diagnosticCode(error)
  return Match.value(error).pipe(
    Match.when(Match.instanceOf(PersistenceError), (failure) => ({
      type: "PersistenceError",
      operation: operations.has(failure.operation)
        ? failure.operation
        : "unknown",
      code,
    })),
    Match.when(Match.instanceOf(DatabaseError), (failure) => ({
      type: "DatabaseError",
      operation: operations.has(failure.operation)
        ? failure.operation
        : "unknown",
      code,
    })),
    Match.when(Match.instanceOf(ConfigurationError), () => ({
      type: "ConfigurationError",
      code,
    })),
    Match.when(Match.instanceOf(InvalidInput), () => ({
      type: "InvalidInput",
      code,
    })),
    Match.orElse(() => ({ type: "UnexpectedError", code })),
  )
}

export function logFailure(exit: Exit.Exit<unknown, unknown>) {
  Exit.match(exit, {
    onSuccess: () => undefined,
    onFailure: (cause) => {
      console.error("[Flowmark API] Request failed", {
        failures: Array.from(Cause.failures(cause), describeFailure),
        defects: Array.from(Cause.defects(cause), describeFailure),
        interrupted: Cause.isInterrupted(cause),
      })
    },
  })
}
