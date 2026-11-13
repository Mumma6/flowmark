import { Context, Data, Effect, Layer, Match, Schema } from "effect"
import { loadBindings } from "./loader.js"

const Finite = Schema.Number.check(Schema.isFinite())
const Count = Schema.Number.check(
  Schema.isInt(),
  Schema.isGreaterThanOrEqualTo(0),
)
export const OperationEventSchema = Schema.Struct({
  type: Schema.String,
  operationId: Schema.NullOr(Schema.String),
  operationName: Schema.NullOr(Schema.String),
  durationMs: Schema.NullOr(Finite),
  timestamp: Schema.String,
})
export type OperationEvent = typeof OperationEventSchema.Type
export const OperationSummarySchema = Schema.Struct({
  name: Schema.String,
  occurrenceCount: Count,
  openCount: Count,
  failedCount: Count,
  medianDurationMs: Schema.NullOr(Finite),
  totalRecordedDurationMs: Schema.NullOr(Finite),
  durationMs: Schema.NullOr(Finite),
  status: Schema.Literals(["completed", "failed", "open"]),
})
export type OperationSummary = typeof OperationSummarySchema.Type
export class EvidenceEngineError extends Data.TaggedError(
  "EvidenceEngineError",
)<{
  readonly operation: "summarizeOperations" | "percentile"
  readonly stage:
    "initialization" | "input" | "invocation" | "output" | "calculation"
  readonly cause: unknown
}> {}

const Envelope = Schema.fromJsonString(
  Schema.Union([
    Schema.Struct({
      version: Schema.Literal(1),
      tag: Schema.Literal("Ok"),
      value: Schema.Unknown,
    }),
    Schema.Struct({
      version: Schema.Literal(1),
      tag: Schema.Literal("Error"),
      message: Schema.String,
    }),
  ]),
)

export interface EvidenceEngineService {
  readonly summarizeOperations: (
    events: readonly OperationEvent[],
  ) => Effect.Effect<readonly OperationSummary[], EvidenceEngineError>
  readonly percentile: (
    values: readonly number[],
    p: number,
  ) => Effect.Effect<number | null, EvidenceEngineError>
}

export class EvidenceEngine extends Context.Service<
  EvidenceEngine,
  EvidenceEngineService
>()("@flowmark/evidence-engine/EvidenceEngine") {
  static readonly layer = Layer.succeed(
    EvidenceEngine,
    EvidenceEngine.of({
      summarizeOperations: Effect.fn("EvidenceEngine.summarizeOperations")(
        function* (events) {
          const input = yield* Schema.decodeUnknownEffect(
            Schema.Array(OperationEventSchema),
          )(events).pipe(
            Effect.mapError(
              (cause) =>
                new EvidenceEngineError({
                  operation: "summarizeOperations",
                  stage: "input",
                  cause,
                }),
            ),
          )
          return yield* invoke(
            "summarizeOperations",
            JSON.stringify(input),
            Schema.Array(OperationSummarySchema),
          )
        },
      ),
      percentile: Effect.fn("EvidenceEngine.percentile")(function* (values, p) {
        const input = yield* Schema.decodeUnknownEffect(
          Schema.Struct({ values: Schema.Array(Finite), p: Finite }),
        )({ values, p }).pipe(
          Effect.mapError(
            (cause) =>
              new EvidenceEngineError({
                operation: "percentile",
                stage: "input",
                cause,
              }),
          ),
        )
        return yield* invoke(
          "percentile",
          JSON.stringify(input),
          Schema.NullOr(Finite),
        )
      }),
    }),
  )
}

const invoke = Effect.fn("EvidenceEngine.invoke")(function* <
  S extends Schema.Constraint,
>(operation: EvidenceEngineError["operation"], input: string, output: S) {
  const bindings = yield* loadBindings().pipe(
    Effect.mapError(
      (cause) =>
        new EvidenceEngineError({ operation, stage: "initialization", cause }),
    ),
  )
  const raw = yield* Effect.try({
    try: () =>
      Match.value(operation).pipe(
        Match.when("summarizeOperations", () =>
          bindings.summarize_operations_json(input),
        ),
        Match.when("percentile", () => bindings.percentile_json(input)),
        Match.exhaustive,
      ),
    catch: (cause) =>
      new EvidenceEngineError({ operation, stage: "invocation", cause }),
  })
  const envelope = yield* Schema.decodeUnknownEffect(Envelope)(raw).pipe(
    Effect.mapError(
      (cause) => new EvidenceEngineError({ operation, stage: "output", cause }),
    ),
  )
  return yield* Match.value(envelope).pipe(
    Match.when({ tag: "Error" }, ({ message }) =>
      Effect.fail(
        new EvidenceEngineError({
          operation,
          stage: "calculation",
          cause: message,
        }),
      ),
    ),
    Match.when({ tag: "Ok" }, ({ value }) =>
      Schema.decodeUnknownEffect(output)(value).pipe(
        Effect.mapError(
          (cause) =>
            new EvidenceEngineError({ operation, stage: "output", cause }),
        ),
      ),
    ),
    Match.exhaustive,
  )
})
