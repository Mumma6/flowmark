import * as Data from "effect/Data"
import type { ToolEvidence } from "./tool-result.js"
import * as Match from "effect/Match"
import * as Result from "effect/Result"
import * as Schema from "effect/Schema"

export type EvidenceAction = "refresh" | "next"
export type EvidenceMessage = {
  readonly kind: "message"
  readonly status:
    "waiting" | "invalid" | "unavailable" | "access-unavailable" | "closed"
  readonly message: string
}

const accessFailure = Schema.Struct({
  isError: Schema.Literal(true),
  _meta: Schema.Struct({
    "io.flowmark/evidence": Schema.Struct({
      state: Schema.Literal("access-unavailable"),
    }),
  }),
})

/** A presentation hint, never proof of authority. No error-text matching. */
export const readFailure = (value: unknown): EvidenceMessage =>
  Match.value(
    Result.isSuccess(Schema.decodeUnknownResult(accessFailure)(value)),
  ).pipe(
    Match.when(true, () => ({
      kind: "message" as const,
      status: "access-unavailable" as const,
      message:
        "Access cannot be verified. It may have expired, been revoked or changed. Reconnect or select authorized evidence in the host; previous evidence and actions have been cleared.",
    })),
    Match.orElse(() => ({
      kind: "message" as const,
      status: "unavailable" as const,
      message:
        "Evidence is unavailable. Access may have expired or been revoked, or the read failed. Check the host's complete structured/text result and reconnect or select evidence there. Previous evidence and actions have been cleared.",
    })),
  )

export type EvidenceViewState =
  | EvidenceMessage
  | {
      readonly kind: "snapshot"
      readonly evidence: ToolEvidence
      readonly busy: boolean
      readonly canRead: boolean
    }
export class EvidenceReadError extends Data.TaggedError("EvidenceReadError")<{
  readonly operation: "connect" | "read"
  readonly cause: unknown
}> {}

export class EvidenceChannelOverloaded extends Data.TaggedError(
  "EvidenceChannelOverloaded",
) {}
