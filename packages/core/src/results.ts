import { Schema } from "effect"

/** Canonical, application-owned terminal business code. No normalization. */
export const WorkflowOutcomeSchema = Schema.String.pipe(
  Schema.pattern(/^[a-z][a-z0-9_-]{0,63}$/),
)
export type WorkflowOutcome = Schema.Schema.Type<typeof WorkflowOutcomeSchema>
const Label = Schema.String.pipe(
  Schema.minLength(1),
  Schema.maxLength(80),
  Schema.filter((s) => s.trim().length > 0),
)
const Path = Schema.Array(
  Schema.String.pipe(Schema.minLength(1), Schema.maxLength(128)),
).pipe(Schema.minItems(1), Schema.maxItems(5))
const Field = Schema.Struct({
  path: Path,
  label: Label,
  kind: Schema.Literal("count", "category", "reasons"),
  unit: Schema.optional(Label),
})
/** Ordered bounded presentation metadata. Revisions cannot be overwritten. */
export const ResultDeclarationSchema = Schema.Struct({
  revision: WorkflowOutcomeSchema,
  fields: Schema.Array(Field).pipe(Schema.maxItems(12)),
}).pipe(
  Schema.filter(
    (declaration) =>
      new Set(declaration.fields.map((field) => JSON.stringify(field.path)))
        .size === declaration.fields.length,
  ),
)
export type ResultDeclaration = Schema.Schema.Type<
  typeof ResultDeclarationSchema
>
