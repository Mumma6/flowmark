import { decodeBusinessResult, isBusinessResult } from "./business-result.js"
import * as HashSet from "effect/HashSet"
import * as Array from "effect/Array"
import { pipe } from "effect/Function"
import * as Data from "effect/Data"
import * as Result from "effect/Result"
import * as Schema from "effect/Schema"
import { buildSuppliedRunSnapshot } from "./projection.js"

export class EvidenceInputError extends Data.TaggedError("EvidenceInputError")<{
  readonly reason: string
}> {}
const text = Schema.String.check(Schema.isMaxLength(8192))
const reference = Schema.String.check(
  Schema.isMinLength(1),
  Schema.isMaxLength(256),
)
const count = Schema.Number.check(
  Schema.isInt(),
  Schema.isGreaterThanOrEqualTo(0),
)
const instant = reference.check(
  Schema.makeFilter((value) => Number.isFinite(Date.parse(value))),
)
const input = Schema.Struct({
  limit: Schema.optional(
    count.check(
      Schema.isGreaterThanOrEqualTo(1),
      Schema.isLessThanOrEqualTo(100),
    ),
  ),
  projectId: reference,
  runId: reference,
  section: Schema.optional(Schema.String),
  cursor: Schema.optional(
    Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(2048)),
  ),
})
const evidence = Schema.Struct({
  tool: Schema.Literal("get_run"),
  projectId: reference,
  runId: reference,
  section: Schema.Literal("events"),
  summary: Schema.Struct({
    id: reference,
    workflow: text,
    startedAt: instant,
    status: Schema.Literals(["Completed", "Failed", "Running"]),
    durationMs: Schema.NullOr(
      Schema.Number.check(Schema.isFinite(), Schema.isGreaterThanOrEqualTo(0)),
    ),
  }),
  page: Schema.Struct({
    runId: reference,
    events: Schema.Array(
      Schema.Struct({ id: reference, type: reference, timestamp: instant }),
    ).check(Schema.isMaxLength(100)),
    nextCursor: Schema.NullOr(
      Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(2048)),
    ),
    limit: count.check(
      Schema.isGreaterThanOrEqualTo(1),
      Schema.isLessThanOrEqualTo(100),
    ),
    totalEvents: count,
  }),
})

/** Only completed results bound to the supplied invocation can become a view. */
const decodeDiagnosticToolEvidence = (
  argumentsValue: unknown,
  resultValue: unknown,
) =>
  Result.gen(function* () {
    const serialized = yield* Result.try({
      try: () => JSON.stringify(resultValue),
      catch: () =>
        new EvidenceInputError({ reason: "Invalid evidence result." }),
    })
    if (
      typeof serialized !== "string" ||
      new TextEncoder().encode(serialized).byteLength > 65536
    ) {
      return yield* Result.fail(
        new EvidenceInputError({
          reason: "Evidence result exceeds the existing 64 KiB limit.",
        }),
      )
    }
    const args = yield* Schema.decodeUnknownResult(input)(argumentsValue).pipe(
      Result.mapError(
        () =>
          new EvidenceInputError({
            reason: "No valid run invocation was supplied.",
          }),
      ),
    )
    const envelope = yield* Schema.decodeUnknownResult(
      Schema.Struct({
        isError: Schema.optional(Schema.Boolean),
        structuredContent: Schema.optional(Schema.Unknown),
      }),
    )(resultValue).pipe(
      Result.mapError(
        () =>
          new EvidenceInputError({
            reason: "No structured evidence result was supplied.",
          }),
      ),
    )
    if (envelope.isError) {
      return yield* Result.fail(
        new EvidenceInputError({
          reason: "The evidence read failed. Use the host's text result.",
        }),
      )
    }
    const value = yield* Schema.decodeUnknownResult(evidence)(
      envelope.structuredContent,
    ).pipe(
      Result.mapError(
        () =>
          new EvidenceInputError({
            reason:
              "This result has no supported bounded events view. Use the complete structured/text result in the host.",
          }),
      ),
    )
    if (
      args.projectId !== value.projectId ||
      args.runId !== value.runId ||
      value.summary.id !== value.runId ||
      value.page.runId !== value.runId ||
      (args.section !== undefined && args.section !== "events")
    ) {
      return yield* Result.fail(
        new EvidenceInputError({
          reason: "Result references do not match the supplied invocation.",
        }),
      )
    }
    if (
      (args.limit !== undefined && value.page.limit > args.limit) ||
      (args.cursor !== undefined && args.cursor === value.page.nextCursor) ||
      value.page.events.length > value.page.limit ||
      value.page.totalEvents < value.page.events.length
    ) {
      return yield* Result.fail(
        new EvidenceInputError({ reason: "Event page coverage is invalid." }),
      )
    }
    if (
      pipe(
        value.page.events,
        Array.map((event) => event.id),
        HashSet.fromIterable,
        HashSet.size,
      ) !== value.page.events.length
    ) {
      return yield* Result.fail(
        new EvidenceInputError({ reason: "Duplicate event references." }),
      )
    }
    const projected = buildSuppliedRunSnapshot(
      value.projectId,
      value.summary,
      value.page,
      Boolean(args.cursor),
    )
    if (!projected) {
      return yield* Result.fail(
        new EvidenceInputError({
          reason: "Result references are inconsistent.",
        }),
      )
    }
    return {
      kind: "diagnostic" as const,
      snapshot: projected,
      // Carry only validated read references; discard the rest of the RPC envelope.
      invocation: {
        projectId: args.projectId,
        runId: args.runId,
        section: "events" as const,
        limit: value.page.limit,
        ...(args.cursor === undefined ? {} : { cursor: args.cursor }),
      },
      nextCursor: value.page.nextCursor,
    }
  })

type DiagnosticToolEvidence = Result.Result.Success<
  ReturnType<typeof decodeDiagnosticToolEvidence>
>
type BusinessToolEvidence = Result.Result.Success<
  ReturnType<typeof decodeBusinessResult>
>
export const decodeToolEvidence = (
  args: unknown,
  result: unknown,
): Result.Result<
  DiagnosticToolEvidence | BusinessToolEvidence,
  EvidenceInputError
> => {
  if (isBusinessResult(result)) {
    const serialized = Result.try(() => JSON.stringify(result))
    if (
      Result.isFailure(serialized) ||
      typeof serialized.success !== "string" ||
      new TextEncoder().encode(serialized.success).byteLength > 65536
    ) {
      return Result.fail(
        new EvidenceInputError({
          reason: "Business evidence exceeds the 64 KiB view limit.",
        }),
      )
    }
    return decodeBusinessResult(args, result).pipe(
      Result.mapError(
        () =>
          new EvidenceInputError({
            reason:
              "Business evidence is invalid or does not match its invocation.",
          }),
      ),
    )
  }
  return decodeDiagnosticToolEvidence(args, result)
}

export type ToolEvidence = Result.Result.Success<
  ReturnType<typeof decodeToolEvidence>
>
export type EvidenceInvocation = ToolEvidence["invocation"]

export const projectToolEvidence = (
  argumentsValue: unknown,
  resultValue: unknown,
) =>
  decodeToolEvidence(argumentsValue, resultValue).pipe(
    Result.flatMap((value) =>
      value.kind === "diagnostic"
        ? Result.succeed(value.snapshot)
        : Result.fail(
            new EvidenceInputError({
              reason:
                "This is a business evidence view, not a diagnostic snapshot.",
            }),
          ),
    ),
  )
