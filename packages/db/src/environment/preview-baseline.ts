import { createHash } from "node:crypto"
import { Effect, Option } from "effect"
import { PreviewBaselineError } from "./error.js"

export function committedMigrationHash(sqlText: string): string {
  return createHash("sha256").update(sqlText).digest("hex")
}

export type PreviewBaselineState = {
  readonly userTableExists: boolean
  readonly workflowsTableExists: boolean
  readonly userRowCount: number
  readonly workflowRowCount: number
  readonly migrationRowCount: number
}

export const decidePreviewBaseline = Effect.fn("decidePreviewBaseline")(
  function* (state: PreviewBaselineState) {
    if (state.migrationRowCount > 0) {
      return Option.some(
        "Preview baseline skipped: migration history is already present.",
      )
    }
    if (!state.userTableExists && !state.workflowsTableExists) {
      return Option.some(
        "Preview baseline skipped: schema is absent. Committed migrations will create it.",
      )
    }
    if (state.userTableExists !== state.workflowsTableExists) {
      return yield* new PreviewBaselineError({
        reason: "Refusing preview baseline: the schema is only partly present.",
      })
    }
    if (state.userRowCount > 0 || state.workflowRowCount > 0) {
      return yield* new PreviewBaselineError({
        reason:
          "Refusing preview baseline: user or workflows already has rows. This branch is not an empty schema-only copy.",
      })
    }
    return Option.none()
  },
)
