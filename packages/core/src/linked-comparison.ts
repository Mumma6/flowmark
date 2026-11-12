import { Array, Match, Option, Schema } from "effect"
import {
  BusinessTimestampSchema,
  ResultPathSchema,
} from "./business-insights.js"
import { WorkflowOutcomeSchema } from "./results.js"
import { BusinessKeySchema, BusinessValueSchema } from "./search-fields.js"
import type { JourneyRunReference } from "./reference-journey.js"

const Name = Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(200))
const Release = Schema.String.check(
  Schema.isMinLength(1),
  Schema.isMaxLength(128),
)

/** Absolute upstream start windows; only direct, unambiguous parent links create pairs. */
export const LinkedComparisonQuerySchema = Schema.Struct({
  upstreamWorkflow: Name,
  upstreamRevision: WorkflowOutcomeSchema,
  downstreamWorkflow: Name,
  downstreamRevision: WorkflowOutcomeSchema,
  numerator: ResultPathSchema,
  denominator: ResultPathSchema,
  currentStartedAfter: BusinessTimestampSchema,
  currentStartedBefore: BusinessTimestampSchema,
  previousStartedAfter: BusinessTimestampSchema,
  previousStartedBefore: BusinessTimestampSchema,
  businessKey: Schema.optional(BusinessKeySchema),
  businessValue: Schema.optional(BusinessValueSchema),
  releaseA: Schema.optional(Release),
  releaseB: Schema.optional(Release),
}).check(
  Schema.makeFilter((query) => {
    const current =
      Date.parse(query.currentStartedBefore) -
      Date.parse(query.currentStartedAfter)
    const previous =
      Date.parse(query.previousStartedBefore) -
      Date.parse(query.previousStartedAfter)
    return (
      query.upstreamWorkflow !== query.downstreamWorkflow &&
      current > 0 &&
      current <= 31 * 86400000 &&
      previous > 0 &&
      previous <= 31 * 86400000 &&
      Date.parse(query.previousStartedBefore) <=
        Date.parse(query.currentStartedAfter) &&
      (query.businessKey === undefined) ===
        (query.businessValue === undefined) &&
      (query.releaseA === undefined) === (query.releaseB === undefined) &&
      (query.releaseA === undefined || query.releaseA !== query.releaseB)
    )
  }),
)
export type LinkedComparisonQuery = typeof LinkedComparisonQuerySchema.Type

export const LINKED_COVERAGE = [
  "upstreamRevision",
  "ambiguousParent",
  "missingLink",
  "multipleLinks",
  "releaseMismatch",
  "downstreamRevision",
  "unfinished",
  "missingResult",
  "missingMetric",
  "invalidMetric",
  "known",
] as const
export const LinkedCoverageSchema = Schema.Literals(LINKED_COVERAGE)
export type LinkedCoverage = typeof LinkedCoverageSchema.Type
export const LinkedEvidenceQuerySchema = Schema.Struct({
  query: LinkedComparisonQuerySchema,
  scope: Schema.Literals(["current", "previous"]),
  coverage: Schema.optional(LinkedCoverageSchema),
  cursor: Schema.optional(Schema.String.check(Schema.isMaxLength(2048))),
  limit: Schema.optional(
    Schema.Number.check(
      Schema.isInt(),
      Schema.isBetween({ minimum: 1, maximum: 50 }),
    ),
  ),
})
export type LinkedEvidenceQuery = typeof LinkedEvidenceQuerySchema.Type

export interface LinkedComparisonWindow {
  readonly scope: "current" | "previous"
  readonly anchors: number
  readonly knownPairs: number
  readonly coverage: Readonly<Record<LinkedCoverage, number>>
  readonly failedKnownPairs: number
  readonly numerator: string | null
  readonly denominator: string | null
  readonly ratio: number | null
}

export const linkedComparisonAvailability = (
  windows: readonly LinkedComparisonWindow[],
) => {
  const current = Array.findFirst(
    windows,
    (window) => window.scope === "current",
  )
  const previous = Array.findFirst(
    windows,
    (window) => window.scope === "previous",
  )
  const reason = Match.value({
    empty:
      windows.length !== 2 ||
      Option.isNone(current) ||
      Option.isNone(previous) ||
      Array.some(windows, (window) => window.anchors === 0),
    incompatible: Array.some(
      windows,
      (window) =>
        window.coverage.upstreamRevision > 0 ||
        window.coverage.downstreamRevision > 0,
    ),
    thin: Array.some(windows, (window) => window.knownPairs < 5),
    missingRatio: Array.some(windows, (window) => window.ratio === null),
  }).pipe(
    Match.when({ empty: true }, () => "Empty" as const),
    Match.when({ incompatible: true }, () => "Incompatible" as const),
    Match.when({ thin: true }, () => "Thin" as const),
    Match.when({ missingRatio: true }, () => "ZeroDenominator" as const),
    Match.orElse(() => null),
  )
  const delta = Option.all({
    current: Option.flatMap(current, (window) =>
      Option.fromNullishOr(window.ratio),
    ),
    previous: Option.flatMap(previous, (window) =>
      Option.fromNullishOr(window.ratio),
    ),
  }).pipe(
    Option.map(({ current, previous }) => current - previous),
    Option.getOrNull,
  )
  return {
    available: reason === null,
    reason,
    minimumKnownPairs: 5 as const,
    delta: reason === null ? delta : null,
  }
}

export const LINKED_COMPARISON_BOUNDS = {
  maximumAnchorsPerWindow: 10000,
  maximumFallbackEvents: 100000,
  statementTimeoutMs: 5000,
} as const
export const LINKED_COMPARISON_CAVEAT =
  "Recorded execution pairs only. Missing links may reflect sampling or retained-history gaps; this is not an exhaustive conversion funnel, unique-customer count or causal result." as const

export interface LinkedComparison {
  readonly query: LinkedComparisonQuery
  readonly numeratorLabel: string
  readonly denominatorLabel: string
  readonly windows: readonly LinkedComparisonWindow[]
  readonly comparison: ReturnType<typeof linkedComparisonAvailability>
  readonly bounds: typeof LINKED_COMPARISON_BOUNDS
  readonly caveat: typeof LINKED_COMPARISON_CAVEAT
}
export interface LinkedEvidenceRow {
  readonly anchor: JourneyRunReference
  readonly downstream:
    | (JourneyRunReference & {
        readonly status: "Completed" | "Failed" | "Running"
        readonly release: string | null
        readonly revision: string | null
      })
    | null
  readonly coverage: LinkedCoverage
  readonly numerator: string | null
  readonly denominator: string | null
}
export interface LinkedEvidencePage {
  readonly query: LinkedEvidenceQuery
  readonly rows: readonly LinkedEvidenceRow[]
  readonly total: number
  readonly nextCursor: string | null
  readonly bounds: typeof LINKED_COMPARISON_BOUNDS
  readonly caveat: typeof LINKED_COMPARISON_CAVEAT
}

/** Carries the exact question, never credentials or an authorization grant. */
export const LinkedComparisonSelectionSchema = Schema.Struct({
  version: Schema.Literal(1),
  kind: Schema.Literal("linked-comparison"),
  projectId: Schema.String.check(Schema.isGUID()),
  query: LinkedComparisonQuerySchema,
  evidence: Schema.optional(
    Schema.Struct({
      scope: Schema.Literals(["current", "previous"]),
      coverage: Schema.optional(LinkedCoverageSchema),
      cursor: Schema.optional(Schema.String.check(Schema.isMaxLength(2048))),
    }),
  ),
})
export type LinkedComparisonSelection =
  typeof LinkedComparisonSelectionSchema.Type
