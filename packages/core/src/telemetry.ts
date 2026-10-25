import { Schema } from "effect"

export const WorkflowErrorSchema = Schema.Struct({
  code: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(128)),
  message: Schema.optional(Schema.String.pipe(Schema.maxLength(2048))),
  retryable: Schema.optional(Schema.Boolean),
  handled: Schema.Boolean,
})

export const WorkflowProgressFields = {
  completed: Schema.Number.pipe(
    Schema.filter(Number.isSafeInteger),
    Schema.nonNegative(),
  ),
  total: Schema.optional(
    Schema.Number.pipe(
      Schema.filter(Number.isSafeInteger),
      Schema.nonNegative(),
    ),
  ),
  unit: Schema.optional(
    Schema.String.pipe(Schema.minLength(1), Schema.maxLength(64)),
  ),
}

export const WorkflowProgressSchema = Schema.Struct(
  WorkflowProgressFields,
).pipe(
  Schema.filter(
    ({ completed, total }) => total === undefined || completed <= total,
  ),
)

/** A recoverable error event; `handled` records whether application code handled it. */
export type WorkflowError = Schema.Schema.Type<typeof WorkflowErrorSchema>
/** Absolute progress snapshot for a workflow run. */
export type WorkflowProgress = Schema.Schema.Type<typeof WorkflowProgressSchema>
