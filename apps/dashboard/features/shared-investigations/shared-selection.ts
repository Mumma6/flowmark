import { Match, Result, Schema } from "effect"
import {
  SharedInvestigationSelectionSchema,
  type SavedSelection,
  type SharedInvestigationSelection,
} from "@flowmarkdev/core"
import { savedSelectionHref } from "../investigations/saved-selection"
export const sharedQuestionHref = (projectId: string, id: string) =>
  `/investigations?project=${encodeURIComponent(projectId)}&shared=${encodeURIComponent(id)}`
export const sharedSelectionHref = (
  projectId: string,
  selection: SharedInvestigationSelection,
) =>
  Schema.decodeUnknownResult(SharedInvestigationSelectionSchema, {
    onExcessProperty: "error",
  })(selection).pipe(
    Result.flatMap((value) =>
      Match.value(value).pipe(
        Match.when({ depth: "diagnostic" }, ({ query }) =>
          savedSelectionHref(projectId, query),
        ),
        Match.when({ depth: "business" }, ({ query }) =>
          Result.succeed(
            `/?businessSelection=${encodeURIComponent(JSON.stringify(query))}`,
          ),
        ),
        Match.exhaustive,
      ),
    ),
  )
export const businessSelectionFromSaved = (
  selection: SavedSelection,
): SharedInvestigationSelection | null =>
  selection.kind === "run" &&
  selection.section === "events" &&
  selection.cursor === undefined
    ? {
        version: 1,
        depth: "business",
        query: { kind: "run", runId: selection.runId },
      }
    : null
