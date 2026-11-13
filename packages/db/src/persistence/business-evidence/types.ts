import { Data } from "effect"
export class EvidenceAccessRejected extends Data.TaggedError(
  "EvidenceAccessRejected",
)<{
  readonly reason: "Unauthorized" | "Stale" | "Unavailable"
}> {}
