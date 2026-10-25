import { Schema } from "effect"

export const WorkflowNameSchema = Schema.String
export const WorkflowRunIdSchema = Schema.String
export const WorkflowStepNameSchema = Schema.String
export type WorkflowName = Schema.Schema.Type<typeof WorkflowNameSchema>
export type WorkflowRunId = Schema.Schema.Type<typeof WorkflowRunIdSchema>
export type WorkflowStepName = Schema.Schema.Type<typeof WorkflowStepNameSchema>

export const WorkflowLinkIdSchema = Schema.String.pipe(
  Schema.maxLength(200),
  Schema.filter((value) => value.trim().length > 0),
)

/** Optional explicit grouping identifier; do not use secrets or personal data. */
export const WorkflowCorrelationIdSchema = Schema.String.pipe(
  Schema.maxLength(128),
  Schema.filter((value) => value.trim().length > 0),
)
export type WorkflowCorrelationId = Schema.Schema.Type<
  typeof WorkflowCorrelationIdSchema
>

export const IngestionIdentifierSchema = Schema.String.pipe(
  Schema.maxLength(200),
  Schema.filter((value) => value.trim().length > 0),
)
