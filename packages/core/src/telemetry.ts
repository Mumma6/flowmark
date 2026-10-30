import { Schema } from "effect"

export const WorkflowErrorSchema = Schema.Struct({
  code: Schema.String.pipe(
    Schema.check(Schema.isMinLength(1)),
    Schema.check(Schema.isMaxLength(128)),
  ),
  message: Schema.optional(
    Schema.String.pipe(Schema.check(Schema.isMaxLength(2048))),
  ),
  retryable: Schema.optional(Schema.Boolean),
  handled: Schema.Boolean,
})

export const WorkflowProgressFields = {
  completed: Schema.Number.pipe(
    Schema.check(Schema.makeFilter(Number.isSafeInteger)),
    Schema.check(Schema.isGreaterThanOrEqualTo(0)),
  ),
  total: Schema.optional(
    Schema.Number.pipe(
      Schema.check(Schema.makeFilter(Number.isSafeInteger)),
      Schema.check(Schema.isGreaterThanOrEqualTo(0)),
    ),
  ),
  unit: Schema.optional(
    Schema.String.pipe(
      Schema.check(Schema.isMinLength(1)),
      Schema.check(Schema.isMaxLength(64)),
    ),
  ),
}

export const WorkflowProgressSchema = Schema.Struct(
  WorkflowProgressFields,
).pipe(
  Schema.check(
    Schema.makeFilter(
      ({ completed, total }) => total === undefined || completed <= total,
    ),
  ),
)

/** A recoverable error event; `handled` records whether application code handled it. */
export type WorkflowError = typeof WorkflowErrorSchema.Type
/** Absolute progress snapshot for a workflow run. */
export type WorkflowProgress = typeof WorkflowProgressSchema.Type
