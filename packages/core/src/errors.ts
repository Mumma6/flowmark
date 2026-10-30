import { Schema } from "effect"

export const WorkflowFailureSchema = Schema.Struct({
  code: Schema.String.pipe(
    Schema.check(Schema.isMinLength(1)),
    Schema.check(Schema.isMaxLength(128)),
  ),
  message: Schema.optional(
    Schema.String.pipe(Schema.check(Schema.isMaxLength(2048))),
  ),
  retryable: Schema.optional(Schema.Boolean),
})

/** Structured details for a terminal `failed` event. */
export type WorkflowFailure = typeof WorkflowFailureSchema.Type
/** A bounded operation failure code and optional diagnostic detail. */
export type WorkflowOperationFailure = WorkflowFailure
