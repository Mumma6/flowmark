import {
  decodePeriodCohortSelection,
  decodeRunInvestigationSelection,
  type PeriodCohortSelection,
  type RunInvestigationSelection,
} from "@flowmarkdev/core"
import { Data, Match, Option, Result } from "effect"

/** Studio's internal route run id, never the application's external SDK run id. */
export const studioRunSelection = (projectId: string, runId: string) =>
  decodeRunInvestigationSelection({
    version: 1,
    kind: "run",
    projectId,
    runId,
    section: "events",
  })

export { periodCohortToolInput, runSelectionToolInput } from "@flowmarkdev/core"

export const runSelectionQueryKey = "selection"

const unsupportedSelection =
  "This link's investigation selection is unsupported or damaged. The current project and saved filters stay as they are."

const otherProject =
  "This link names a different project. It does not switch projects or widen the query."

const otherRun =
  "This selection names a different run from the page address. The page keeps the run in the path."

export type RunSelectionRoundTrip = Data.TaggedEnum<{
  Absent: Record<never, never>
  Pending: Record<never, never>
  Rejected: { readonly message: string }
  Accepted: { readonly selection: RunInvestigationSelection }
}>

export const RunSelection = Data.taggedEnum<RunSelectionRoundTrip>()

const sameId = (left: string, right: string) =>
  left.toLowerCase() === right.toLowerCase()

const parseSelectionJson = (value: string) =>
  Result.try({
    try: () => JSON.parse(value) as unknown,
    catch: () => unsupportedSelection,
  })

/** A selection query never supplies project authority or a wider filter set. */
export const interpretRunSelection = (input: {
  readonly raw: string | null
  readonly projectId: string | undefined
  readonly runId: string
}): RunSelectionRoundTrip => {
  if (input.raw === null || input.raw.trim() === "") {
    return RunSelection.Absent()
  }
  return Result.match(parseSelectionJson(input.raw), {
    onFailure: () => RunSelection.Rejected({ message: unsupportedSelection }),
    onSuccess: (value) =>
      decodeRunInvestigationSelection(value).pipe(
        Result.match({
          onFailure: () =>
            RunSelection.Rejected({ message: unsupportedSelection }),
          onSuccess: (selection) => {
            if (!input.projectId) {
              return RunSelection.Pending()
            }
            const projectId = input.projectId
            return Match.value(selection).pipe(
              Match.when(
                (item) => !sameId(item.projectId, projectId),
                () => RunSelection.Rejected({ message: otherProject }),
              ),
              Match.when(
                (item) => !sameId(item.runId, input.runId),
                () => RunSelection.Rejected({ message: otherRun }),
              ),
              Match.orElse((item) =>
                RunSelection.Accepted({ selection: item }),
              ),
            )
          },
        }),
      ),
  })
}

export const evidencePageForSection = (
  roundTrip: RunSelectionRoundTrip,
  section: RunInvestigationSelection["section"],
) =>
  Match.value(roundTrip).pipe(
    Match.tag("Accepted", (accepted) =>
      accepted.selection.section === section
        ? Option.some({
            cursor: accepted.selection.cursor,
            limit: accepted.selection.limit,
          })
        : Option.none(),
    ),
    Match.orElse(() => Option.none()),
  )

export const periodCohortReturnHref = (selection: PeriodCohortSelection) => {
  const params = new URLSearchParams({
    workflow: selection.workflow,
    startedAfterExact: selection.currentStartedAfter,
    startedBeforeExclusive: selection.currentStartedBefore,
    [runSelectionQueryKey]: JSON.stringify(selection),
  })
  return `/?${params}`
}

const periodFilterConflict =
  "This period selection does not match the filters on the page. Those filters stay in place."

export type PeriodCohortRoundTrip = Data.TaggedEnum<{
  Absent: Record<never, never>
  Pending: Record<never, never>
  Rejected: { readonly message: string }
  Accepted: { readonly selection: PeriodCohortSelection }
}>

export const PeriodCohort = Data.taggedEnum<PeriodCohortRoundTrip>()

export const interpretPeriodCohort = (input: {
  readonly raw: string | null
  readonly projectId: string | undefined
  readonly workflow: string
  readonly startedAfterExact: string
  readonly startedBeforeExclusive: string
  readonly definitionRevision: string
  readonly environment: string
}): PeriodCohortRoundTrip => {
  const raw = input.raw
  if (raw === null || raw.trim() === "") {
    return PeriodCohort.Absent()
  }
  const parsed = Result.try({
    try: () => JSON.parse(raw) as unknown,
    catch: () => unsupportedSelection,
  })
  return Result.match(parsed, {
    onFailure: () => PeriodCohort.Rejected({ message: unsupportedSelection }),
    onSuccess: (value) => {
      if (Result.isSuccess(decodeRunInvestigationSelection(value))) {
        return PeriodCohort.Absent()
      }
      return decodePeriodCohortSelection(value).pipe(
        Result.match({
          onFailure: () =>
            PeriodCohort.Rejected({ message: unsupportedSelection }),
          onSuccess: (selection) => {
            if (!input.projectId) {
              return PeriodCohort.Pending()
            }
            if (!sameId(selection.projectId, input.projectId)) {
              return PeriodCohort.Rejected({ message: otherProject })
            }
            const agrees =
              input.workflow === selection.workflow &&
              input.startedAfterExact === selection.currentStartedAfter &&
              input.startedBeforeExclusive === selection.currentStartedBefore &&
              input.definitionRevision === "" &&
              input.environment === ""
            return agrees
              ? PeriodCohort.Accepted({ selection })
              : PeriodCohort.Rejected({ message: periodFilterConflict })
          },
        }),
      )
    },
  })
}

/** Preserve the accepted section/page when copying a handoff; reject damaged links. */
export const handoffRunSelection = (
  projectId: string,
  runId: string,
  raw: string | null,
) =>
  Match.value(interpretRunSelection({ projectId, runId, raw })).pipe(
    Match.tag("Absent", () =>
      studioRunSelection(projectId, runId).pipe(
        Result.mapError(() => unsupportedSelection),
      ),
    ),
    Match.tag("Accepted", ({ selection }) => Result.succeed(selection)),
    Match.tag("Rejected", ({ message }) => Result.fail(message)),
    Match.tag("Pending", () =>
      Result.fail("Select a project before copying this investigation."),
    ),
    Match.exhaustive,
  )

/** A linked event wins over the evidence page selected by a round-trip URL. */
export const initialTimelineView = (
  linkedEventId: string | undefined,
  selection: ReturnType<typeof interpretRunSelection>,
): "timeline" | "waterfall" | "events" => {
  if (linkedEventId) {
    return "events"
  }
  return Match.value(selection).pipe(
    Match.tag("Accepted", (accepted) =>
      Match.value(accepted.selection.section).pipe(
        Match.when("operations", () => "waterfall" as const),
        Match.when("events", () => "events" as const),
        Match.orElse(() => "timeline" as const),
      ),
    ),
    Match.orElse(() => "timeline" as const),
  )
}
