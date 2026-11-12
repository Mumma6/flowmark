import { Schema } from "effect"
import {
  PeriodCohortSelectionSchema,
  RunInvestigationSelectionSchema,
} from "./investigation-selection.js"
import { LinkedComparisonSelectionSchema } from "./linked-comparison.js"

/** Questions only: never arbitrary routes, credentials or captured evidence. */
export const SavedSelectionSchema = Schema.Union([
  RunInvestigationSelectionSchema,
  PeriodCohortSelectionSchema,
  LinkedComparisonSelectionSchema,
]).check(
  Schema.makeFilter(
    (value) =>
      new TextEncoder().encode(JSON.stringify(value)).byteLength <= 16384,
  ),
)
export type SavedSelection = typeof SavedSelectionSchema.Type
export const SaveInvestigationSchema = Schema.Struct({
  title: Schema.String.check(
    Schema.isMinLength(1),
    Schema.isMaxLength(120),
    Schema.makeFilter((title) => title.trim().length > 0),
  ),
  selection: SavedSelectionSchema,
})
export type SaveInvestigation = typeof SaveInvestigationSchema.Type
export const SavedInvestigationListSchema = Schema.Struct({
  cursor: Schema.optional(Schema.String.check(Schema.isMaxLength(2048))),
  limit: Schema.optional(
    Schema.Number.check(
      Schema.isInt(),
      Schema.isBetween({ minimum: 1, maximum: 25 }),
    ),
  ),
})
export type SavedInvestigationList = typeof SavedInvestigationListSchema.Type
export interface SavedInvestigationSummary {
  readonly id: string
  readonly title: string
  readonly createdAt: string
  readonly kind: SavedSelection["kind"] | null
  readonly supported: boolean
}
export interface SavedInvestigation extends SavedInvestigationSummary {
  readonly selection: SavedSelection | null
}
export interface SavedInvestigationPage {
  readonly items: readonly SavedInvestigationSummary[]
  readonly nextCursor: string | null
}
