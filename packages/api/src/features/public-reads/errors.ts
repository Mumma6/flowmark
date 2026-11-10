import { Data } from "effect"

export type PublicReadCode =
  | "INVALID_REQUEST"
  | "UNSUPPORTED_VERSION"
  | "UNSUPPORTED_SELECTION"
  | "INVALID_CURSOR"
  | "UNAUTHORIZED"
  | "PROJECT_FORBIDDEN"
  | "RUN_NOT_FOUND"
  | "METHOD_NOT_ALLOWED"
  | "REQUEST_TOO_LARGE"
  | "UNSUPPORTED_MEDIA_TYPE"
  | "EVIDENCE_TOO_LARGE"
  | "RATE_LIMITED"
  | "READ_UNAVAILABLE"
  | "READ_TIMEOUT"

export class PublicReadFailure extends Data.TaggedError("PublicReadFailure")<{
  readonly code: PublicReadCode
  readonly cause?: unknown
  readonly retryAfterSeconds?: number
}> {}

/** Drizzle wraps the native PostgreSQL cancellation code in a cause. */
export const isReadStatementTimeout = (cause: unknown): boolean =>
  typeof cause === "object" &&
  cause !== null &&
  (("code" in cause && cause.code === "57014") ||
    ("cause" in cause &&
      cause.cause !== cause &&
      isReadStatementTimeout(cause.cause)))

export const publicStorageFailure = (cause: unknown) =>
  new PublicReadFailure({
    code: isReadStatementTimeout(cause) ? "READ_TIMEOUT" : "READ_UNAVAILABLE",
    cause,
  })
