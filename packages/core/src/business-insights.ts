import { Schema } from "effect"
import { WorkflowOutcomeSchema } from "./results.js"

export const ResultPathSchema = Schema.Array(
  Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(128)),
).check(Schema.isMinLength(1), Schema.isMaxLength(5))
export const ResultSelectionSchema = Schema.Struct({
  revision: WorkflowOutcomeSchema,
  path: ResultPathSchema,
  operator: Schema.Literals(["eq", "gte", "lte"]),
  value: Schema.Union([
    Schema.String.check(Schema.isMaxLength(2048)),
    Schema.Number.check(
      Schema.makeFilter(Number.isSafeInteger),
      Schema.isGreaterThanOrEqualTo(0),
    ),
  ]),
  reason: Schema.optional(
    Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(128)),
  ),
})
export const RatioSelectionSchema = Schema.Struct({
  revision: WorkflowOutcomeSchema,
  numerator: ResultPathSchema,
  denominator: ResultPathSchema,
})
export type RatioSelection = typeof RatioSelectionSchema.Type
export type ResultSelection = typeof ResultSelectionSchema.Type
export const BusinessTimestampSchema = Schema.String.check(
  Schema.isMaxLength(40),
  Schema.makeFilter(
    (value) =>
      Number.isFinite(Date.parse(value)) &&
      new Date(value).toISOString() === value,
  ),
)
export const BusinessInsightsQuerySchema = Schema.Struct({
  workflow: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(200)),
  revision: WorkflowOutcomeSchema,
  path: ResultPathSchema,
  currentStartedAfter: BusinessTimestampSchema,
  currentStartedBefore: BusinessTimestampSchema,
  previousStartedAfter: BusinessTimestampSchema,
  previousStartedBefore: BusinessTimestampSchema,
  businessKey: Schema.optional(Schema.String.check(Schema.isMaxLength(128))),
  businessValue: Schema.optional(Schema.String.check(Schema.isMaxLength(2048))),
  numerator: Schema.optional(ResultPathSchema),
  denominator: Schema.optional(ResultPathSchema),
  releaseA: Schema.optional(
    Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(128)),
  ),
  releaseB: Schema.optional(
    Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(128)),
  ),
}).check(
  Schema.makeFilter((query) => {
    const current =
      Date.parse(query.currentStartedBefore) -
      Date.parse(query.currentStartedAfter)
    const previous =
      Date.parse(query.previousStartedBefore) -
      Date.parse(query.previousStartedAfter)
    return (
      current > 0 &&
      previous > 0 &&
      current <= 31 * 86400000 &&
      previous <= 31 * 86400000 &&
      Boolean(query.numerator) === Boolean(query.denominator) &&
      Boolean(query.releaseA) === Boolean(query.releaseB) &&
      (query.releaseA === undefined || query.releaseA !== query.releaseB) &&
      (query.businessKey === undefined) === (query.businessValue === undefined)
    )
  }),
)
export type BusinessInsightsQuery = typeof BusinessInsightsQuerySchema.Type
export interface BusinessWindow {
  readonly scope: "current" | "previous" | "releaseA" | "releaseB"
  readonly totalRuns: number
  readonly finishedRuns: number
  readonly failedRuns: number
  readonly openRuns: number
  readonly incompatibleRevision: number
  readonly missingResult: number
  readonly missingField: number
  readonly wrongType: number
  readonly unknownCategory: number
  readonly knownRuns: number
  readonly total: string | null
  readonly missingOutcome: number
  readonly otherOutcomeRuns: number
  readonly outcomes: readonly { value: string; runs: number }[]
  readonly categories: readonly {
    value: string
    runs: number
    total: string | null
  }[]
  readonly daily: readonly {
    date: string
    finishedRuns: number
    knownRuns: number
    total: string | null
  }[]
  readonly ratio: {
    knownRuns: number
    numerator: string | null
    denominator: string | null
    value: number | null
  }
}
export interface BusinessInsights {
  readonly query: BusinessInsightsQuery
  readonly field: {
    readonly path: readonly string[]
    readonly label: string
    readonly kind: "count" | "category" | "reasons"
    readonly unit?: string
  }
  readonly windows: readonly BusinessWindow[]
  readonly releaseComparison: {
    readonly available: boolean
    readonly reason: string | null
    readonly minimumRuns: number
  }
}
