import { Schema } from "effect"
import { IngestionIdentifierSchema } from "./identifiers.js"

/** Application-reported operation retry identity, scoped to one run and operation name. */
export const WorkflowAttemptSchema = Schema.Struct({
  groupId: Schema.String.check(
    Schema.isMaxLength(128),
    Schema.makeFilter((value) => value.trim().length > 0),
  ),
  number: Schema.Number.check(
    Schema.makeFilter((value) => Number.isSafeInteger(value) && value > 0),
  ),
})
export type WorkflowAttempt = typeof WorkflowAttemptSchema.Type

/** Qualified external run identity; never a credential or a continuation request. */
export const WorkflowRetryReferenceSchema = Schema.Struct({
  workflow: IngestionIdentifierSchema,
  runId: IngestionIdentifierSchema,
})
export type WorkflowRetryReference = typeof WorkflowRetryReferenceSchema.Type
