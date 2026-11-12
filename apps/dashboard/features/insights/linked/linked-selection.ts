import {
  LinkedComparisonQuerySchema,
  LinkedComparisonSelectionSchema,
  ResultPathSchema,
  type LinkedComparisonQuery,
  type LinkedComparisonSelection,
} from "@flowmarkdev/core"
import { Result, Schema } from "effect"
import { periodWindow } from "../../period/period"

export const linkedQueryKey = "linked"
const decode = Schema.decodeUnknownResult(
  Schema.fromJsonString(LinkedComparisonSelectionSchema),
  { onExcessProperty: "error" },
)
export const readLinkedSelection = (
  value: string | null,
  projectId: string,
): Result.Result<LinkedComparisonSelection | null, string> => {
  if (value === null) {
    return Result.succeed(null)
  }
  if (value.length > 16384) {
    return Result.fail("The linked comparison selection is too large.")
  }
  return decode(value).pipe(
    Result.mapError(
      () =>
        "This comparison selection is invalid or unsupported. Review the form and analyze a new selection.",
    ),
    Result.flatMap((selection) =>
      selection.projectId === projectId
        ? Result.succeed(selection)
        : Result.fail(
            "This comparison belongs to another project. Select that project or create a new comparison here.",
          ),
    ),
  )
}
export const linkedComparisonLocation = (
  selection: LinkedComparisonSelection,
) =>
  `/insights?${new URLSearchParams({ view: "linked", [linkedQueryKey]: JSON.stringify(selection) })}`

export interface LinkedComparisonDraft {
  readonly upstreamWorkflow: string
  readonly upstreamRevision: string
  readonly downstreamWorkflow: string
  readonly downstreamRevision: string
  readonly numerator: string
  readonly denominator: string
  readonly currentStartedAfter: string
  readonly currentStartedBefore: string
  readonly previousStartedAfter: string
  readonly previousStartedBefore: string
  readonly businessKey: string
  readonly businessValue: string
  readonly releaseA: string
  readonly releaseB: string
}
export const linkedDraft = (
  query?: LinkedComparisonQuery,
): LinkedComparisonDraft => {
  const period = periodWindow(7)
  return {
    upstreamWorkflow: query?.upstreamWorkflow ?? "",
    upstreamRevision: query?.upstreamRevision ?? "",
    downstreamWorkflow: query?.downstreamWorkflow ?? "",
    downstreamRevision: query?.downstreamRevision ?? "",
    numerator: JSON.stringify(query?.numerator ?? ["confirmed"]),
    denominator: JSON.stringify(query?.denominator ?? ["requested"]),
    currentStartedAfter: (
      query?.currentStartedAfter ?? period.currentStartedAfter
    ).slice(0, -1),
    currentStartedBefore: (
      query?.currentStartedBefore ?? period.currentStartedBefore
    ).slice(0, -1),
    previousStartedAfter: (
      query?.previousStartedAfter ?? period.previousStartedAfter
    ).slice(0, -1),
    previousStartedBefore: (
      query?.previousStartedBefore ?? period.previousStartedBefore
    ).slice(0, -1),
    businessKey: query?.businessKey ?? "",
    businessValue: query?.businessValue ?? "",
    releaseA: query?.releaseA ?? "",
    releaseB: query?.releaseB ?? "",
  }
}
const UtcInput = Schema.String.check(
  Schema.isPattern(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?$/),
  Schema.makeFilter((value) => {
    const parsed = Date.parse(`${value}Z`)
    return (
      Number.isFinite(parsed) &&
      new Date(parsed).toISOString().startsWith(value)
    )
  }),
)
const utc = (value: string) =>
  Schema.decodeUnknownResult(UtcInput)(value).pipe(
    Result.map((valid) => new Date(Date.parse(`${valid}Z`)).toISOString()),
    Result.mapError(() => "Enter valid UTC dates and times."),
  )
const path = (value: string) =>
  Schema.decodeUnknownResult(Schema.fromJsonString(ResultPathSchema))(
    value,
  ).pipe(
    Result.mapError(
      () => 'Result paths must be JSON arrays, for example ["confirmed"].',
    ),
  )

export const buildLinkedQuery = (draft: LinkedComparisonDraft) =>
  Result.all({
    currentStartedAfter: utc(draft.currentStartedAfter),
    currentStartedBefore: utc(draft.currentStartedBefore),
    previousStartedAfter: utc(draft.previousStartedAfter),
    previousStartedBefore: utc(draft.previousStartedBefore),
    numerator: path(draft.numerator),
    denominator: path(draft.denominator),
  }).pipe(
    Result.flatMap((parsed) =>
      Schema.decodeUnknownResult(LinkedComparisonQuerySchema, {
        onExcessProperty: "error",
      })({
        ...parsed,
        upstreamWorkflow: draft.upstreamWorkflow,
        upstreamRevision: draft.upstreamRevision,
        downstreamWorkflow: draft.downstreamWorkflow,
        downstreamRevision: draft.downstreamRevision,
        ...(draft.businessKey || draft.businessValue
          ? {
              businessKey: draft.businessKey,
              businessValue: draft.businessValue,
            }
          : {}),
        ...(draft.releaseA || draft.releaseB
          ? { releaseA: draft.releaseA, releaseB: draft.releaseB }
          : {}),
      }).pipe(
        Result.mapError(
          () =>
            "Choose distinct workflows, declared revisions and nonoverlapping windows of at most 31 days. Supply both dimension fields and both distinct releases when using them.",
        ),
      ),
    ),
  )
