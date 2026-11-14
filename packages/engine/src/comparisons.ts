import { Effect, Schema } from "effect"
import { Count, Finite } from "./contracts.js"
import { OperationSummarySchema } from "./operations.js"
import { invoke } from "./boundary.js"

export const ComparisonInputSchema = Schema.Struct({
  current: Schema.Array(OperationSummarySchema),
  peers: Schema.Array(
    Schema.Struct({
      runId: Schema.String,
      status: Schema.Literals(["Completed", "Failed", "Running"]),
      durationMs: Schema.NullOr(Finite),
      operations: Schema.Array(OperationSummarySchema),
    }),
  ),
  names: Schema.Array(Schema.String),
})
export type ComparisonInput = typeof ComparisonInputSchema.Type
const OperationComparison = Schema.Struct({
  name: Schema.String,
  currentDurationMs: Schema.NullOr(Finite),
  currentOccurrenceCount: Count,
  currentOpenCount: Count,
  currentFailedCount: Count,
  currentMedianOccurrenceDurationMs: Schema.NullOr(Finite),
  currentTotalRecordedDurationMs: Schema.NullOr(Finite),
  currentStatus: Schema.Literals(["completed", "failed", "open", "absent"]),
  peerMedianDurationMs: Schema.NullOr(Finite),
  peerMedianOccurrenceDurationMs: Schema.NullOr(Finite),
  peerMedianTotalRecordedDurationMs: Schema.NullOr(Finite),
  peerOpenRunCount: Count,
  peerFailedRunCount: Count,
  peerPresentCount: Count,
  peerRunIds: Schema.Array(Schema.String),
})
export const ComparisonSchema = Schema.Struct({
  peerSuccessRate: Schema.NullOr(Finite),
  peerMedianDurationMs: Schema.NullOr(Finite),
  peerP95DurationMs: Schema.NullOr(Finite),
  operations: Schema.Array(OperationComparison),
})
export type Comparison = typeof ComparisonSchema.Type
export const compareSummaries = Effect.fn("Engine.compareSummaries")(
  (input: ComparisonInput) =>
    invoke("compareSummaries", input, ComparisonInputSchema, ComparisonSchema),
)
