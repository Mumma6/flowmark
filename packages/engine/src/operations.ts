import { Effect, Schema } from "effect"
import { Count, Finite } from "./contracts.js"
import { invoke } from "./boundary.js"
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
export const summarizeOperations = Effect.fn("Engine.summarizeOperations")(
  (events: readonly OperationEvent[]) =>
    invoke(
      "summarizeOperations",
      events,
      Schema.Array(OperationEventSchema),
      Schema.Array(OperationSummarySchema),
    ),
)
