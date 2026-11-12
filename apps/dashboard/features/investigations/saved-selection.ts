import { Match, Result, Schema } from "effect"
import { SavedSelectionSchema, type SavedSelection } from "@flowmarkdev/core"
import { runInvestigationPath } from "../runs/investigation/investigation-navigation"
import { periodCohortReturnHref } from "../runs/investigation/investigation-selection"
import { linkedComparisonLocation } from "../insights/linked/linked-selection"
export const decodeSavedSelection = Schema.decodeUnknownResult(
  SavedSelectionSchema,
  { onExcessProperty: "error" },
)
/** Construct internal destinations exclusively from the accepted shared schemas. */
export const savedSelectionHref = (projectId: string, input: unknown) =>
  decodeSavedSelection(input).pipe(
    Result.filterOrFail(
      (selection) =>
        selection.projectId.toLowerCase() === projectId.toLowerCase(),
      () => "This investigation belongs to another project.",
    ),
    Result.map((selection) =>
      Match.value(selection).pipe(
        Match.when({ kind: "run" }, (selection) =>
          runInvestigationPath(
            selection.runId,
            undefined,
            undefined,
            undefined,
            selection,
          ),
        ),
        Match.when({ kind: "period" }, periodCohortReturnHref),
        Match.when({ kind: "linked-comparison" }, linkedComparisonLocation),
        Match.exhaustive,
      ),
    ),
  )
export const savedSelectionTitle = (selection: SavedSelection) =>
  Match.value(selection)
    .pipe(
      Match.when({ kind: "run" }, ({ runId }) => `Run ${runId}`),
      Match.when({ kind: "period" }, ({ workflow }) => `${workflow} period`),
      Match.when(
        { kind: "linked-comparison" },
        ({ query }) =>
          `${query.upstreamWorkflow} → ${query.downstreamWorkflow}`,
      ),
      Match.exhaustive,
    )
    .slice(0, 120)
export const privateInvestigationKey = (
  userId: string | null,
  projectId: string,
) => ["private-investigations", userId, projectId] as const
