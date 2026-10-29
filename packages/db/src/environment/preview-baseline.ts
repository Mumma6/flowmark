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

const baselineLabel = (branch: "preview" | "staging") =>
  branch === "staging" ? "Staging" : "Preview"

export const decidePreviewBaseline = Effect.fn("decidePreviewBaseline")(
  function* (
    state: PreviewBaselineState,
    branch: "preview" | "staging" = "preview",
  ) {
    const label = baselineLabel(branch)
    if (state.migrationRowCount > 0) {
      return Option.some(
        `${label} baseline skipped: migration history is already present.`,
      )
    }
    if (!state.userTableExists && !state.workflowsTableExists) {
      return Option.some(
        `${label} baseline skipped: schema is absent. Committed migrations will create it.`,
      )
    }
    if (state.userTableExists !== state.workflowsTableExists) {
      return yield* new PreviewBaselineError({
        reason: `Refusing ${branch} baseline: the schema is only partly present.`,
      })
    }
    if (state.userRowCount > 0 || state.workflowRowCount > 0) {
      return yield* new PreviewBaselineError({
        reason: `Refusing ${branch} baseline: user or workflows already has rows. This branch is not an empty schema-only copy.`,
      })
    }
    return Option.none()
  },
)
