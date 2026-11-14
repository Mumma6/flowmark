import { Effect, Match, Result, Schema } from "effect"
import {
  SharedInvestigationSelectionSchema,
  type BusinessMeaning,
  type SharedInvestigationSelection,
} from "@flowmarkdev/core"
import { InvalidInput } from "../../../errors.js"
import { validateBusinessSelection } from "../../business-evidence/rules/selection.js"
export const decodeSharedSelection = Schema.decodeUnknownResult(
  SharedInvestigationSelectionSchema,
  { onExcessProperty: "error" },
)
export const validateSharedSelection = Effect.fn("validateSharedSelection")(
  function* (
    projectId: string,
    role: "owner" | "viewer" | "business",
    selection: SharedInvestigationSelection,
    meaning: BusinessMeaning,
  ) {
    if (selection.depth === "diagnostic") {
      if (
        role === "business" ||
        selection.query.projectId.toLowerCase() !== projectId.toLowerCase()
      ) {
        return yield* new InvalidInput({
          cause: "This shared investigation is unavailable.",
        })
      }
      if (
        selection.query.kind === "run" &&
        selection.query.cursor !== undefined
      ) {
        return yield* new InvalidInput({
          cause: "Share a first-page question without continuation cursors.",
        })
      }
      return
    }
    const continued = Match.value(selection.query).pipe(
      Match.when({ kind: "runs" }, ({ query }) => query.cursor !== undefined),
      Match.when(
        { kind: "journey" },
        ({ query }) =>
          query.cursor !== undefined || query.candidateCursor !== undefined,
      ),
      Match.orElse(() => false),
    )
    if (continued) {
      return yield* new InvalidInput({
        cause: "Share a first-page question without continuation cursors.",
      })
    }
    yield* validateBusinessSelection(selection.query, meaning)
  },
)
export const supportedSharedSelection = (input: unknown) =>
  decodeSharedSelection(input).pipe(Result.getOrNull)
