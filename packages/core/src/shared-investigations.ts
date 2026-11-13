import { Schema } from "effect"
import { BusinessEvidenceQuerySchema } from "./business-evidence.js"
import { SavedSelectionSchema } from "./saved-investigations.js"

/** An evidence ceiling, never a grant or a copy of a private object's authority. */
export const SharedInvestigationSelectionSchema = Schema.Union([
  Schema.Struct({
    version: Schema.Literal(1),
    depth: Schema.Literal("diagnostic"),
    query: SavedSelectionSchema,
  }),
  Schema.Struct({
    version: Schema.Literal(1),
    depth: Schema.Literal("business"),
    query: BusinessEvidenceQuerySchema,
  }),
]).check(
  Schema.makeFilter(
    (value) =>
      new TextEncoder().encode(JSON.stringify(value)).byteLength <= 16384,
  ),
)
export type SharedInvestigationSelection =
  typeof SharedInvestigationSelectionSchema.Type
export const ShareInvestigationSchema = Schema.Struct({
  title: Schema.String.check(
    Schema.isMinLength(1),
    Schema.isMaxLength(120),
    Schema.makeFilter((value) => value.trim().length > 0),
  ),
  selection: SharedInvestigationSelectionSchema,
})
export type ShareInvestigation = typeof ShareInvestigationSchema.Type
export const SharedInvestigationListSchema = Schema.Struct({
  cursor: Schema.optional(Schema.String.check(Schema.isMaxLength(2048))),
  limit: Schema.optional(
    Schema.Number.check(
      Schema.isInt(),
      Schema.isBetween({ minimum: 1, maximum: 25 }),
    ),
  ),
})
export type SharedInvestigationList = typeof SharedInvestigationListSchema.Type
export interface SharedInvestigationSummary {
  readonly id: string
  readonly title: string | null
  readonly createdAt: string
  readonly depth: "business" | "diagnostic" | null
  readonly canRevoke: boolean
  readonly available: boolean
}
export interface SharedInvestigation extends SharedInvestigationSummary {
  readonly title: string
  readonly depth: "business" | "diagnostic"
  readonly available: true
  readonly selection: SharedInvestigationSelection
}
export interface SharedInvestigationPage {
  readonly items: readonly SharedInvestigationSummary[]
  readonly nextCursor: string | null
}
