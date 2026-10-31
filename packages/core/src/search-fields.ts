import { Schema } from "effect"

export const BusinessKeySchema = Schema.String.check(
  Schema.isPattern(/^[a-zA-Z][a-zA-Z0-9_]{0,63}$/),
)
export const BusinessValueSchema = Schema.String.check(
  Schema.isMinLength(1),
  Schema.isMaxLength(256),
)
const Field = Schema.Union([
  Schema.Struct({ key: BusinessKeySchema, role: Schema.Literal("lookup") }),
  Schema.Struct({
    key: BusinessKeySchema,
    role: Schema.Literal("dimension"),
    values: Schema.Array(BusinessValueSchema).check(
      Schema.isMinLength(1),
      Schema.isMaxLength(20),
      Schema.makeFilter((values) => new Set(values).size === values.length),
    ),
  }),
])
/** Explicit top-level string search permissions, not automatic field discovery. */
export const SearchFieldsSchema = Schema.Array(Field).check(
  Schema.isMaxLength(8),
  Schema.makeFilter(
    (fields) =>
      new Set(fields.map((field) => field.key)).size === fields.length,
  ),
)
export type SearchFields = typeof SearchFieldsSchema.Type
