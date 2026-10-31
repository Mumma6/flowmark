import { parseArgs } from "node:util"
import { Effect, Schema } from "effect"
import { CommandConfigurationError } from "../environment/error.js"

const Uuid = Schema.String.check(
  Schema.isPattern(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  ),
)
export const FactCheckpoint = Schema.Struct({
  version: Schema.Literal(1),
  target: Schema.String,
  project: Uuid,
  after: Schema.NullOr(Uuid),
})
export const readRunFactsOptions = Effect.fn("readRunFactsOptions")(function* (
  args: string[],
) {
  const { values } = yield* Effect.try({
    try: () =>
      parseArgs({
        args,
        options: {
          project: { type: "string" },
          after: { type: "string" },
          "batch-size": { type: "string", default: "25" },
          "max-runs": { type: "string", default: "100" },
          checkpoint: { type: "string" },
          apply: { type: "boolean", default: false },
        },
      }),
    catch: () =>
      new CommandConfigurationError({
        reason:
          "Unknown run-facts option. Supply --project UUID, optionally --batch-size 1..100, --max-runs 1..10000, --after UUID, --checkpoint PATH and --apply.",
      }),
  })
  const project = yield* Schema.decodeUnknownEffect(Uuid)(values.project).pipe(
    Effect.mapError(
      () =>
        new CommandConfigurationError({ reason: "--project must be a UUID." }),
    ),
  )
  const after = yield* Schema.decodeUnknownEffect(Schema.NullOr(Uuid))(
    values.after ?? null,
  ).pipe(
    Effect.mapError(
      () =>
        new CommandConfigurationError({ reason: "--after must be a UUID." }),
    ),
  )
  const batchSize = Number(values["batch-size"]),
    maxRuns = Number(values["max-runs"])
  if (
    !Number.isInteger(batchSize) ||
    batchSize < 1 ||
    batchSize > 100 ||
    !Number.isInteger(maxRuns) ||
    maxRuns < 1 ||
    maxRuns > 10000
  ) {
    return yield* new CommandConfigurationError({
      reason: "Batch size must be 1..100 and maximum runs 1..10000.",
    })
  }
  if (values.apply && !values.checkpoint) {
    return yield* new CommandConfigurationError({
      reason:
        "--apply requires --checkpoint PATH for interruption-safe resume.",
    })
  }
  if (after && values.checkpoint) {
    return yield* new CommandConfigurationError({
      reason: "Use either --after or --checkpoint, not both.",
    })
  }
  return {
    project,
    after,
    batchSize,
    maxRuns,
    checkpoint: values.checkpoint,
    apply: values.apply,
  }
})
