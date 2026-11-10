import { Schema } from "effect"
import { BusinessTimestampSchema } from "./business-insights.js"
import { PeriodCohortSelectionSchema } from "./investigation-selection.js"

/** The accepted Studio/MCP technical-period question, without extra filters. */
export const PeriodReadInputSchema = PeriodCohortSelectionSchema
export type PeriodReadInput = typeof PeriodReadInputSchema.Type

const Count = Schema.Number.check(
  Schema.isInt(),
  Schema.isGreaterThanOrEqualTo(0),
)
const Duration = Schema.NullOr(Schema.Number.check(Schema.isFinite()))
export const PeriodReadWindowSchema = Schema.Struct({
  startedAfter: BusinessTimestampSchema,
  startedBefore: BusinessTimestampSchema,
  totalRuns: Count,
  finishedRuns: Count,
  completedRuns: Count,
  failedRuns: Count,
  successRate: Schema.NullOr(
    Schema.Number.check(Schema.isBetween({ minimum: 0, maximum: 100 })),
  ),
  medianDurationMs: Duration,
  p95DurationMs: Duration,
})
export type PeriodReadWindow = typeof PeriodReadWindowSchema.Type

export const PeriodReadResponseSchema = Schema.Struct({
  version: Schema.Literal(1),
  mode: Schema.Literal("technical"),
  selection: PeriodReadInputSchema,
  observedAt: BusinessTimestampSchema,
  capabilities: Schema.Array(Schema.Literal("technical_period_windows")).check(
    Schema.isMinLength(1),
    Schema.isMaxLength(1),
  ),
  report: Schema.Struct({
    workflow: Schema.String,
    current: PeriodReadWindowSchema,
    previous: PeriodReadWindowSchema,
  }),
  coverage: Schema.Struct({
    currentOpenRuns: Count,
    previousOpenRuns: Count,
    previousWindowHasRuns: Schema.Boolean,
    // Existing aggregates do not expose how many runs reported a duration.
    durationObservationCounts: Schema.Null,
  }),
  continuation: Schema.Null,
  evidence: Schema.Struct({ periodPath: Schema.String }),
  omissions: Schema.Array(Schema.String),
})
export type PeriodReadResponse = typeof PeriodReadResponseSchema.Type

export const periodReadEvidencePath = (selection: PeriodReadInput) => {
  const canonical: PeriodReadInput = {
    version: 1,
    kind: "period",
    projectId: selection.projectId,
    workflow: selection.workflow,
    currentStartedAfter: selection.currentStartedAfter,
    currentStartedBefore: selection.currentStartedBefore,
    previousStartedAfter: selection.previousStartedAfter,
    previousStartedBefore: selection.previousStartedBefore,
  }
  return `/?${new URLSearchParams({
    workflow: selection.workflow,
    startedAfterExact: selection.currentStartedAfter,
    startedBeforeExclusive: selection.currentStartedBefore,
    selection: JSON.stringify(canonical),
  })}`
}

/** Correlate a response with its question; no credential or authority lives here. */
export const matchesPeriodRead = (
  response: PeriodReadResponse,
  input: PeriodReadInput,
) =>
  response.selection.projectId.toLowerCase() ===
    input.projectId.toLowerCase() &&
  response.selection.workflow === input.workflow &&
  response.report.workflow === input.workflow &&
  response.selection.currentStartedAfter === input.currentStartedAfter &&
  response.selection.currentStartedBefore === input.currentStartedBefore &&
  response.selection.previousStartedAfter === input.previousStartedAfter &&
  response.selection.previousStartedBefore === input.previousStartedBefore &&
  response.report.current.startedAfter === input.currentStartedAfter &&
  response.report.current.startedBefore === input.currentStartedBefore &&
  response.report.previous.startedAfter === input.previousStartedAfter &&
  response.report.previous.startedBefore === input.previousStartedBefore &&
  response.coverage.currentOpenRuns ===
    response.report.current.totalRuns - response.report.current.finishedRuns &&
  response.coverage.previousOpenRuns ===
    response.report.previous.totalRuns -
      response.report.previous.finishedRuns &&
  response.coverage.previousWindowHasRuns ===
    response.report.previous.totalRuns > 0 &&
  response.evidence.periodPath === periodReadEvidencePath(response.selection)
