import { Schema } from "effect"
import { IngestionIdentifierSchema } from "./identifiers.js"
import { ResultDeclarationSchema, WorkflowOutcomeSchema } from "./results.js"
import { SearchFieldsSchema } from "./search-fields.js"

/** Explicit metadata only. Runtime instrumentation never uploads this document. */
export const DefinitionImportSchema = Schema.Struct({
  version: Schema.Literal(1),
  source: WorkflowOutcomeSchema,
  workflow: IngestionIdentifierSchema,
  result: Schema.optional(ResultDeclarationSchema),
  searchFields: Schema.optional(SearchFieldsSchema),
}).check(
  Schema.makeFilter(
    (input) => input.result !== undefined || input.searchFields !== undefined,
  ),
)

export type DefinitionImport = typeof DefinitionImportSchema.Type
