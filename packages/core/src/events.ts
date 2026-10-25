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
import { WorkflowFailureSchema } from "./errors.js"

const StartedEventSchema = Schema.Struct({
  type: Schema.Literal("started"),
  workflow: WorkflowNameSchema,
  runId: WorkflowRunIdSchema,
  timestamp: Schema.String,
  properties: Schema.optional(WorkflowPropertiesSchema),
  environment: Schema.optional(Schema.String.pipe(Schema.maxLength(128))),
  release: Schema.optional(Schema.String.pipe(Schema.maxLength(256))),
  correlationId: Schema.optional(WorkflowCorrelationIdSchema),
  parentRunId: Schema.optional(WorkflowLinkIdSchema),
}).pipe(
  Schema.filter(
    ({ runId, parentRunId }) =>
      parentRunId === undefined || parentRunId !== runId,
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

const CompletedEventSchema = Schema.Struct({
  type: Schema.Literal("completed"),
  workflow: WorkflowNameSchema,
  runId: WorkflowRunIdSchema,
  timestamp: Schema.String,
  result: Schema.optional(WorkflowResultSchema),
})

const FailedEventSchema = Schema.Struct({
  type: Schema.Literal("failed"),
  workflow: WorkflowNameSchema,
  runId: WorkflowRunIdSchema,
  timestamp: Schema.String,
  reason: Schema.optional(Schema.String.pipe(Schema.maxLength(2048))),
  failure: Schema.optional(WorkflowFailureSchema),
  result: Schema.optional(WorkflowResultSchema),
})

const ErrorEventSchema = Schema.Struct({
  type: Schema.Literal("error"),
  workflow: WorkflowNameSchema,
  runId: WorkflowRunIdSchema,
  timestamp: Schema.String,
  error: WorkflowErrorSchema,
})

const OperationDurationSchema = Schema.Number.pipe(
  Schema.filter((duration) => Number.isFinite(duration) && duration >= 0),
)
const OperationNameSchema = Schema.String.pipe(
  Schema.minLength(1),
  Schema.maxLength(200),
  Schema.filter((value) => value.trim().length > 0),
)

const OperationStartedEventSchema = Schema.Struct({
  type: Schema.Literal("operation_started"),
  workflow: WorkflowNameSchema,
  runId: WorkflowRunIdSchema,
  timestamp: Schema.String,
  operationId: Schema.UUID,
  operationName: OperationNameSchema,
  properties: Schema.optional(WorkflowPropertiesSchema),
})

const OperationCompletedEventSchema = Schema.Struct({
  type: Schema.Literal("operation_completed"),
  workflow: WorkflowNameSchema,
  runId: WorkflowRunIdSchema,
  timestamp: Schema.String,
  operationId: Schema.UUID,
  operationName: OperationNameSchema,
  durationMs: OperationDurationSchema,
})

const OperationFailedEventSchema = Schema.Struct({
  type: Schema.Literal("operation_failed"),
  workflow: WorkflowNameSchema,
  runId: WorkflowRunIdSchema,
  timestamp: Schema.String,
  operationId: Schema.UUID,
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
  Schema.filter(
    ({ completed, total }) => total === undefined || completed <= total,
  ),
)

export const WorkflowEventSchema = Schema.Union(
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
)

export type WorkflowEvent = Schema.Schema.Type<typeof WorkflowEventSchema>

export const EventEnvelopeSchema = Schema.Struct({
  eventId: Schema.UUID,
  event: WorkflowEventSchema.pipe(
    Schema.filter(
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
})

export class WorkflowEventValidationError extends Data.TaggedError(
  "WorkflowEventValidationError",
)<{
  readonly input: unknown
  readonly cause: unknown
}> {}

export const decodeWorkflowEvent = Effect.fn("Flowmark.decodeWorkflowEvent")(
  (input: unknown) =>
    Schema.decodeUnknown(WorkflowEventSchema)(input).pipe(
      Effect.mapError(
        (cause) => new WorkflowEventValidationError({ input, cause }),
      ),
    ),
)
