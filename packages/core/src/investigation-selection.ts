import { Result, Schema } from "effect"
import { BusinessTimestampSchema } from "./business-insights.js"

const InternalId = Schema.String.check(
  Schema.isPattern(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  ),
)

const maxWindowMs = 31 * 86_400_000

/** Version 1 deliberately supports a run and one evidence page, not arbitrary cohorts. */
export const RunInvestigationSelectionSchema = Schema.Struct({
  version: Schema.Literal(1),
  kind: Schema.Literal("run"),
  projectId: InternalId,
  runId: InternalId,
  section: Schema.Literals(["events", "related", "expectations", "operations"]),
  cursor: Schema.optional(Schema.String.check(Schema.isMaxLength(2048))),
  limit: Schema.optional(
    Schema.Number.check(
      Schema.isInt(),
      Schema.isBetween({ minimum: 1, maximum: 100 }),
    ),
  ),
})
export type RunInvestigationSelection =
  typeof RunInvestigationSelectionSchema.Type

export const decodeRunInvestigationSelection = (value: unknown) =>
  Schema.decodeUnknownResult(RunInvestigationSelectionSchema)(value, {
    onExcessProperty: "error",
  })

/** No credential travels in a selection. The receiving tool authorizes independently. */
export const runSelectionToolInput = (value: unknown) =>
  decodeRunInvestigationSelection(value).pipe(
    Result.map(({ projectId, runId, section, cursor, limit }) => ({
      projectId,
      runId,
      section,
      cursor,
      limit,
    })),
  )

/**
 * One technical period cohort. Absolute UTC windows, not a rolling day count.
 * A later read can see newer evidence; this is the question, not a snapshot.
 */
export const PeriodCohortSelectionSchema = Schema.Struct({
  version: Schema.Literal(1),
  kind: Schema.Literal("period"),
  projectId: InternalId,
  workflow: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(200)),
  currentStartedAfter: BusinessTimestampSchema,
  currentStartedBefore: BusinessTimestampSchema,
  previousStartedAfter: BusinessTimestampSchema,
  previousStartedBefore: BusinessTimestampSchema,
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
      current <= maxWindowMs &&
      previous <= maxWindowMs &&
      Date.parse(query.previousStartedBefore) <=
        Date.parse(query.currentStartedAfter)
    )
  }),
)
export type PeriodCohortSelection = typeof PeriodCohortSelectionSchema.Type

export const decodePeriodCohortSelection = (value: unknown) =>
  Schema.decodeUnknownResult(PeriodCohortSelectionSchema)(value, {
    onExcessProperty: "error",
  })

/** Maps to get_workflow_insights mode technical. Revision and environment stay rejected. */
export const periodCohortToolInput = (value: unknown) =>
  decodePeriodCohortSelection(value).pipe(
    Result.map(
      ({
        projectId,
        workflow,
        currentStartedAfter,
        currentStartedBefore,
        previousStartedAfter,
        previousStartedBefore,
      }) => ({
        projectId,
        mode: "technical" as const,
        workflow,
        currentStartedAfter,
        currentStartedBefore,
        previousStartedAfter,
        previousStartedBefore,
      }),
    ),
  )
