import { Data } from "effect"
export class InvestigationRejected extends Data.TaggedError(
  "InvestigationRejected",
)<{
  readonly reason: "Unauthorized" | "Limit" | "InvalidCursor"
}> {}
