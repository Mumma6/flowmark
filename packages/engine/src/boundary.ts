import { Effect, Match, Schema } from "effect"
import { EngineError } from "./errors.js"
import { loadBindings } from "./loader.js"
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

export const invoke = Effect.fn("Engine.invoke")(function* <
  I extends Schema.Constraint,
  S extends Schema.Constraint,
>(
  operation: EngineError["operation"],
  input: unknown,
  inputSchema: I,
  output: S,
) {
  const decoded = yield* Schema.decodeUnknownEffect(inputSchema)(input).pipe(
    Effect.mapError(
      (cause) => new EngineError({ operation, stage: "input", cause }),
    ),
  )
  const encoded = JSON.stringify(decoded)
  const bindings = yield* loadBindings().pipe(
    Effect.mapError(
      (cause) => new EngineError({ operation, stage: "initialization", cause }),
    ),
  )
  const raw = yield* Effect.try({
    try: () =>
      Match.value(operation).pipe(
        Match.when("summarizeOperations", () =>
          bindings.summarize_operations_json(encoded),
        ),
        Match.when("percentile", () => bindings.percentile_json(encoded)),
        Match.when("compareSummaries", () =>
          bindings.compare_summaries_json(encoded),
        ),
        Match.when("hasCycle", () => bindings.has_cycle_json(encoded)),
        Match.exhaustive,
      ),
    catch: (cause) =>
      new EngineError({ operation, stage: "invocation", cause }),
  })
  const envelope = yield* Schema.decodeUnknownEffect(Envelope)(raw).pipe(
    Effect.mapError(
      (cause) => new EngineError({ operation, stage: "output", cause }),
    ),
  )
  return yield* Match.value(envelope).pipe(
    Match.when({ tag: "Error" }, ({ message }) =>
      Effect.fail(
        new EngineError({
          operation,
          stage: "calculation",
          cause: message,
        }),
      ),
    ),
    Match.when({ tag: "Ok" }, ({ value }) =>
      Schema.decodeUnknownEffect(output)(value).pipe(
        Effect.mapError(
          (cause) => new EngineError({ operation, stage: "output", cause }),
        ),
      ),
    ),
    Match.exhaustive,
  )
})
