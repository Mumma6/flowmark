import {
  decodePeriodCohortSelection,
  decodeRunInvestigationSelection,
  type PeriodCohortSelection,
  type RunInvestigationSelection,
} from "@flowmarkdev/core"
import { Match, Option, Result } from "effect"

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

export type RunSelectionRoundTrip =
  | { readonly _tag: "Absent" }
  | { readonly _tag: "Pending" }
  | { readonly _tag: "Rejected"; readonly message: string }
  | {
      readonly _tag: "Accepted"
      readonly selection: RunInvestigationSelection
    }

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
    return { _tag: "Absent" }
  }
  return Result.match(parseSelectionJson(input.raw), {
    onFailure: () => ({ _tag: "Rejected", message: unsupportedSelection }),
    onSuccess: (value) =>
      decodeRunInvestigationSelection(value).pipe(
        Result.match({
          onFailure: () => ({
            _tag: "Rejected" as const,
            message: unsupportedSelection,
          }),
          onSuccess: (selection) => {
            if (!input.projectId) {
              return { _tag: "Pending" as const }
            }
            const projectId = input.projectId
            return Match.value(selection).pipe(
              Match.when(
                (item) => !sameId(item.projectId, projectId),
                () => ({ _tag: "Rejected" as const, message: otherProject }),
              ),
              Match.when(
                (item) => !sameId(item.runId, input.runId),
                () => ({ _tag: "Rejected" as const, message: otherRun }),
              ),
              Match.orElse((item) => ({
                _tag: "Accepted" as const,
                selection: item,
              })),
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
  roundTrip._tag === "Accepted" && roundTrip.selection.section === section
    ? Option.some({
        cursor: roundTrip.selection.cursor,
        limit: roundTrip.selection.limit,
      })
    : Option.none()

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

export type PeriodCohortRoundTrip =
  | { readonly _tag: "Absent" }
  | { readonly _tag: "Pending" }
  | { readonly _tag: "Rejected"; readonly message: string }
  | {
      readonly _tag: "Accepted"
      readonly selection: PeriodCohortSelection
    }

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
    return { _tag: "Absent" }
  }
  const parsed = Result.try({
    try: () => JSON.parse(raw) as unknown,
    catch: () => unsupportedSelection,
  })
  return Result.match(parsed, {
    onFailure: () => ({
      _tag: "Rejected" as const,
      message: unsupportedSelection,
    }),
    onSuccess: (value) => {
      if (Result.isSuccess(decodeRunInvestigationSelection(value))) {
        return { _tag: "Absent" as const }
      }
      return decodePeriodCohortSelection(value).pipe(
        Result.match({
          onFailure: () => ({
            _tag: "Rejected" as const,
            message: unsupportedSelection,
          }),
          onSuccess: (selection) => {
            if (!input.projectId) {
              return { _tag: "Pending" as const }
            }
            if (!sameId(selection.projectId, input.projectId)) {
              return { _tag: "Rejected" as const, message: otherProject }
            }
            const agrees =
              input.workflow === selection.workflow &&
              input.startedAfterExact === selection.currentStartedAfter &&
              input.startedBeforeExclusive === selection.currentStartedBefore &&
              input.definitionRevision === "" &&
              input.environment === ""
            return agrees
              ? { _tag: "Accepted" as const, selection }
              : { _tag: "Rejected" as const, message: periodFilterConflict }
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
