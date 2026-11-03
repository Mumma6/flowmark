import { Data } from "effect"

// Deliberately exclude request bodies, provider messages and raw causes: they
// can contain recipients, API keys and bearer links. Safe to log these errors.
export class EmailError extends Data.TaggedError("EmailError")<{
  readonly operation: "configuration" | "validation" | "submission"
  readonly reason:
    | "invalid-configuration"
    | "invalid-message"
    | "idempotency-conflict"
    | "untrusted-url"
    | "network"
    | "timeout"
    | "rejected"
    | "invalid-response"
  readonly status?: number
}> {}
