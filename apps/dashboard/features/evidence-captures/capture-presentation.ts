import { Match } from "effect"
import type { UnavailableEvidenceCapture } from "@flowmarkdev/core"
export const captureUnavailableReason = (
  reason: UnavailableEvidenceCapture["reason"],
) =>
  Match.value(reason).pipe(
    Match.when("Expired", () => "Expired"),
    Match.when("PublicationChanged", () => "Publication rules changed"),
    Match.when("SourceMissing", () => "Source unavailable"),
    Match.when("Invalid", () => "Capture format unavailable"),
    Match.exhaustive,
  )

export const captureHref = (projectId: string, id: string) =>
  `/investigations?project=${encodeURIComponent(projectId)}&capture=${encodeURIComponent(id)}`
