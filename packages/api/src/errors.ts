import { Data } from "effect"

export class Unauthorized extends Data.TaggedError("Unauthorized")<{
  readonly permission: "read" | "write"
}> {}

export class ConfigurationError extends Data.TaggedError("ConfigurationError")<{
  readonly cause: unknown
}> {}

export class PersistenceError extends Data.TaggedError("PersistenceError")<{
  readonly operation: string
  readonly cause: unknown
}> {}

export class RunNotFound extends Data.TaggedError("RunNotFound")<{
  readonly runId: string
}> {}

export class InvalidInput extends Data.TaggedError("InvalidInput")<{
  readonly cause: unknown
}> {}

export class BrowserUnauthorized extends Data.TaggedError(
  "BrowserUnauthorized",
) {}
export class BrowserForbidden extends Data.TaggedError("BrowserForbidden") {}
export class BrowserRateLimited extends Data.TaggedError(
  "BrowserRateLimited",
) {}

export class ExpectationSourceForbidden extends Data.TaggedError(
  "ExpectationSourceForbidden",
) {}
