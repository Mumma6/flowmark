import { Clock, Effect } from "effect"
import type {
  SavedEvidenceExport,
  SavedInvestigation,
  SharedInvestigation,
  EvidenceCaptureRead,
} from "@flowmarkdev/core"
export const exportLiveQuestion = Effect.fn("exportLiveQuestion")(function* (
  visibility: "private" | "project",
  data: SavedInvestigation | SharedInvestigation,
) {
  return {
    version: 1,
    kind: "live-question",
    visibility,
    exportedAt: new Date(yield* Clock.currentTimeMillis).toISOString(),
    notice:
      "Selection only. Reopening recomputes retained evidence with current permissions. This copy grants no access, is not a restore format and cannot be recalled.",
    data,
  } satisfies SavedEvidenceExport
})
export const exportCapturedObservation = Effect.fn("exportCapturedObservation")(
  function* (data: Extract<EvidenceCaptureRead, { available: true }>) {
    return {
      version: 1,
      kind: "captured-observation",
      visibility: "project",
      exportedAt: new Date(yield* Clock.currentTimeMillis).toISOString(),
      notice:
        "Past application-reported observation, not live evidence or verified correctness. Capture expiry does not delete delivered copies. This copy grants no access, is not a restore format and cannot be recalled.",
      data,
    } satisfies SavedEvidenceExport
  },
)
