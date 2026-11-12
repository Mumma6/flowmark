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

const Fingerprint = Schema.String.check(Schema.isPattern(/^[a-f0-9]{64}$/))

/** Both identities must come from the explicit preview reviewed by the caller. */
export const DefinitionImportApplySchema = Schema.Struct({
  definition: DefinitionImportSchema,
  manifestFingerprint: Fingerprint,
  baseFingerprint: Fingerprint,
})
export type DefinitionImportApply = typeof DefinitionImportApplySchema.Type

export interface DefinitionImportReceipt {
  readonly status: "Applied" | "Unchanged" | "AlreadyApplied"
  readonly receiptId: string
  readonly appliedAt: string
  readonly source: string
  readonly workflow: string
  readonly resultRevision: string | null
  readonly addedSearchKeys: ReadonlyArray<string>
}
