import type { SavedInvestigation } from "./saved-investigations.js"
import type { SharedInvestigation } from "./shared-investigations.js"
import type { EvidenceCaptureRead } from "./evidence-captures.js"
/** A delivered copy carries no authority and cannot be recalled. Never a restore format. */
interface ExportReceipt {
  readonly version: 1
  readonly exportedAt: string
  readonly notice: string
}
export type SavedEvidenceExport =
  | (ExportReceipt & {
      readonly kind: "live-question"
      readonly visibility: "private" | "project"
      readonly data: SavedInvestigation | SharedInvestigation
    })
  | (ExportReceipt & {
      readonly kind: "captured-observation"
      readonly visibility: "project"
      readonly data: Extract<EvidenceCaptureRead, { readonly available: true }>
    })
