import { Schema } from "effect"

export const WorkflowFailureSchema = Schema.Struct({
  code: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(128)),
  message: Schema.optional(Schema.String.pipe(Schema.maxLength(2048))),
  retryable: Schema.optional(Schema.Boolean),
})

/** Structured details for a terminal `failed` event. */
export type WorkflowFailure = Schema.Schema.Type<typeof WorkflowFailureSchema>
/** A bounded operation failure code and optional diagnostic detail. */
export type WorkflowOperationFailure = WorkflowFailure
