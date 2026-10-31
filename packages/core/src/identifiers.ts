import { Schema } from "effect"

export const WorkflowNameSchema = Schema.String
export const WorkflowRunIdSchema = Schema.String
export const WorkflowStepNameSchema = Schema.String
export type WorkflowName = typeof WorkflowNameSchema.Type
export type WorkflowRunId = typeof WorkflowRunIdSchema.Type
export type WorkflowStepName = typeof WorkflowStepNameSchema.Type

export const WorkflowLinkIdSchema = Schema.String.pipe(
  Schema.check(Schema.isMaxLength(200)),
  Schema.check(Schema.makeFilter((value) => value.trim().length > 0)),
)

/** Optional explicit grouping identifier; do not use secrets or personal data. */
export const WorkflowCorrelationIdSchema = Schema.String.pipe(
  Schema.check(Schema.isMaxLength(128)),
  Schema.check(Schema.makeFilter((value) => value.trim().length > 0)),
)
export type WorkflowCorrelationId = typeof WorkflowCorrelationIdSchema.Type

export const IngestionIdentifierSchema = Schema.String.pipe(
  Schema.check(Schema.isMaxLength(200)),
  Schema.check(Schema.makeFilter((value) => value.trim().length > 0)),
)

/** Application-propagated external execution identity; not an authorization token. */
export interface WorkflowRunReference {
  readonly workflow: WorkflowName
  readonly runId: WorkflowRunId
}
