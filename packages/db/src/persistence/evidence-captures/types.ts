import { Data } from "effect"
export class EvidenceCaptureRejected extends Data.TaggedError(
  "EvidenceCaptureRejected",
)<{
  readonly reason: "Unauthorized" | "Unavailable" | "Limit" | "Oversized"
}> {}
export interface CaptureMetadata {
  readonly id: string
  readonly sourceRunId: string
  readonly creatorId: string
  readonly capturedAt: string
  readonly expiresAt: string
  readonly reason: "Expired" | "PublicationChanged" | "SourceMissing" | null
}
