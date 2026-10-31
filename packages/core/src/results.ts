import { Schema } from "effect"

/** Canonical, application-owned terminal business code. No normalization. */
export const WorkflowOutcomeSchema = Schema.String.pipe(
  Schema.check(Schema.isPattern(/^[a-z][a-z0-9_-]{0,63}$/)),
)
export type WorkflowOutcome = typeof WorkflowOutcomeSchema.Type
const Label = Schema.String.pipe(
  Schema.check(Schema.isMinLength(1)),
  Schema.check(Schema.isMaxLength(80)),
  Schema.check(Schema.makeFilter((s) => s.trim().length > 0)),
)
const Path = Schema.Array(
  Schema.String.pipe(
    Schema.check(Schema.isMinLength(1)),
    Schema.check(Schema.isMaxLength(128)),
  ),
).pipe(Schema.check(Schema.isMinLength(1)), Schema.check(Schema.isMaxLength(5)))
const Field = Schema.Struct({
  path: Path,
  label: Label,
  kind: Schema.Literals(["count", "category", "reasons"]),
  unit: Schema.optional(Label),
  aggregate: Schema.optional(Schema.Boolean),
  values: Schema.optional(
    Schema.Array(
      Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(128)),
    ).check(
      Schema.isMinLength(1),
      Schema.isMaxLength(20),
      Schema.makeFilter((values) => new Set(values).size === values.length),
    ),
  ),
})
/** Ordered bounded presentation metadata. Revisions cannot be overwritten. */
export const ResultDeclarationSchema = Schema.Struct({
  revision: WorkflowOutcomeSchema,
  fields: Schema.Array(Field).pipe(Schema.check(Schema.isMaxLength(12))),
}).pipe(
  Schema.check(
    Schema.makeFilter(
      (declaration) =>
        declaration.fields.every(
          (field) =>
            !field.aggregate ||
            field.kind === "count" ||
            field.values !== undefined,
        ) &&
        new Set(declaration.fields.map((field) => JSON.stringify(field.path)))
          .size === declaration.fields.length,
    ),
  ),
)
export type ResultDeclaration = typeof ResultDeclarationSchema.Type
