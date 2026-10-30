import { Data, Effect, Match, Schema } from "effect"
import {
  IngestionIdentifierSchema,
  WorkflowCorrelationIdSchema,
  WorkflowLinkIdSchema,
  WorkflowNameSchema,
  WorkflowRunIdSchema,
  WorkflowStepNameSchema,
} from "./identifiers.js"
import { WorkflowPropertiesSchema, WorkflowResultSchema } from "./json.js"
import { WorkflowErrorSchema, WorkflowProgressFields } from "./telemetry.js"
import { WorkflowOutcomeSchema } from "./results.js"
import { WorkflowFailureSchema } from "./errors.js"

// The wire contract validates UUID shape, without imposing RFC version/variant bits.
const UuidSchema = Schema.String.check(
  Schema.isPattern(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  ),
)

const StartedEventSchema = Schema.Struct({
  type: Schema.Literal("started"),
  workflow: WorkflowNameSchema,
  runId: WorkflowRunIdSchema,
  timestamp: Schema.String,
  properties: Schema.optional(WorkflowPropertiesSchema),
  environment: Schema.optional(
    Schema.String.pipe(Schema.check(Schema.isMaxLength(128))),
  ),
  release: Schema.optional(
    Schema.String.pipe(Schema.check(Schema.isMaxLength(256))),
  ),
  correlationId: Schema.optional(WorkflowCorrelationIdSchema),
  parentRunId: Schema.optional(WorkflowLinkIdSchema),
}).pipe(
  Schema.check(
    Schema.makeFilter(
      ({ runId, parentRunId }) =>
        parentRunId === undefined || parentRunId !== runId,
    ),
  ),
)

const StepEventSchema = Schema.Struct({
  type: Schema.Literal("step"),
  workflow: WorkflowNameSchema,
  runId: WorkflowRunIdSchema,
  step: WorkflowStepNameSchema,
  timestamp: Schema.String,
  properties: Schema.optional(WorkflowPropertiesSchema),
})

const PropertiesEventSchema = Schema.Struct({
  type: Schema.Literal("properties"),
  workflow: WorkflowNameSchema,
  runId: WorkflowRunIdSchema,
  timestamp: Schema.String,
  properties: WorkflowPropertiesSchema,
})

const ReportEventSchema = Schema.Struct({
  type: Schema.Literal("report"),
  workflow: WorkflowNameSchema,
  runId: WorkflowRunIdSchema,
  timestamp: Schema.String,
  result: WorkflowResultSchema,
})

const CompletedEventSchema = Schema.Struct({
  type: Schema.Literal("completed"),
  workflow: WorkflowNameSchema,
  runId: WorkflowRunIdSchema,
  timestamp: Schema.String,
  result: Schema.optional(WorkflowResultSchema),
  outcome: Schema.optional(WorkflowOutcomeSchema),
})

const FailedEventSchema = Schema.Struct({
  type: Schema.Literal("failed"),
  workflow: WorkflowNameSchema,
  runId: WorkflowRunIdSchema,
  timestamp: Schema.String,
  reason: Schema.optional(
    Schema.String.pipe(Schema.check(Schema.isMaxLength(2048))),
  ),
  failure: Schema.optional(WorkflowFailureSchema),
  result: Schema.optional(WorkflowResultSchema),
  outcome: Schema.optional(WorkflowOutcomeSchema),
})

const ErrorEventSchema = Schema.Struct({
  type: Schema.Literal("error"),
  workflow: WorkflowNameSchema,
  runId: WorkflowRunIdSchema,
  timestamp: Schema.String,
  error: WorkflowErrorSchema,
})

const OperationDurationSchema = Schema.Number.pipe(
  Schema.check(
    Schema.makeFilter((duration) => Number.isFinite(duration) && duration >= 0),
  ),
)
const OperationNameSchema = Schema.String.pipe(
  Schema.check(Schema.isMinLength(1)),
  Schema.check(Schema.isMaxLength(200)),
  Schema.check(Schema.makeFilter((value) => value.trim().length > 0)),
)

const OperationStartedEventSchema = Schema.Struct({
  type: Schema.Literal("operation_started"),
  workflow: WorkflowNameSchema,
  runId: WorkflowRunIdSchema,
  timestamp: Schema.String,
  operationId: UuidSchema,
  operationName: OperationNameSchema,
  properties: Schema.optional(WorkflowPropertiesSchema),
})

const OperationCompletedEventSchema = Schema.Struct({
  type: Schema.Literal("operation_completed"),
  workflow: WorkflowNameSchema,
  runId: WorkflowRunIdSchema,
  timestamp: Schema.String,
  operationId: UuidSchema,
  operationName: OperationNameSchema,
  durationMs: OperationDurationSchema,
})

const OperationFailedEventSchema = Schema.Struct({
  type: Schema.Literal("operation_failed"),
  workflow: WorkflowNameSchema,
  runId: WorkflowRunIdSchema,
  timestamp: Schema.String,
  operationId: UuidSchema,
  operationName: OperationNameSchema,
  durationMs: OperationDurationSchema,
  failure: WorkflowFailureSchema,
})

const ProgressEventSchema = Schema.Struct({
  type: Schema.Literal("progress"),
  workflow: WorkflowNameSchema,
  runId: WorkflowRunIdSchema,
  timestamp: Schema.String,
  ...WorkflowProgressFields,
}).pipe(
  Schema.check(
    Schema.makeFilter(
      ({ completed, total }) => total === undefined || completed <= total,
    ),
  ),
)
export const WorkflowEventSchema = Schema.Union([
  StartedEventSchema,
  StepEventSchema,
  PropertiesEventSchema,
  CompletedEventSchema,
  FailedEventSchema,
  ErrorEventSchema,
  OperationStartedEventSchema,
  OperationCompletedEventSchema,
  OperationFailedEventSchema,
  ProgressEventSchema,
  ReportEventSchema,
])
export type WorkflowEvent = typeof WorkflowEventSchema.Type

export const EventEnvelopeSchema = Schema.Struct({
  eventId: UuidSchema,
  event: WorkflowEventSchema.pipe(
    Schema.check(
      Schema.makeFilter(
        (event: WorkflowEvent) =>
          Number.isFinite(Date.parse(event.timestamp)) &&
          Schema.is(IngestionIdentifierSchema)(event.workflow) &&
          Schema.is(IngestionIdentifierSchema)(event.runId) &&
          (event.type !== "started" ||
            ((event.correlationId === undefined ||
              Schema.is(WorkflowCorrelationIdSchema)(event.correlationId)) &&
              (event.parentRunId === undefined ||
                (Schema.is(WorkflowLinkIdSchema)(event.parentRunId) &&
                  event.parentRunId !== event.runId)))) &&
          Match.value(event).pipe(
            Match.when({ type: "step" }, ({ step }) =>
              Schema.is(IngestionIdentifierSchema)(step),
            ),
            Match.when({ type: "operation_started" }, ({ operationName }) =>
              Schema.is(IngestionIdentifierSchema)(operationName),
            ),
            Match.when({ type: "operation_completed" }, ({ operationName }) =>
              Schema.is(IngestionIdentifierSchema)(operationName),
            ),
            Match.when({ type: "operation_failed" }, ({ operationName }) =>
              Schema.is(IngestionIdentifierSchema)(operationName),
            ),
            Match.orElse(() => true),
          ),
      ),
    ),
  ),
})

export class WorkflowEventValidationError extends Data.TaggedError(
  "WorkflowEventValidationError",
)<{
  readonly input: unknown
  readonly cause: unknown
}> {}

export const decodeWorkflowEvent = Effect.fn("Flowmark.decodeWorkflowEvent")(
  (input: unknown) =>
    Schema.decodeUnknownEffect(WorkflowEventSchema)(input).pipe(
      Effect.mapError(
        (cause) => new WorkflowEventValidationError({ input, cause }),
      ),
    ),
)
