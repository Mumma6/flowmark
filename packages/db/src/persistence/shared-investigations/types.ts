import { Data } from "effect"
export class SharedInvestigationRejected extends Data.TaggedError(
  "SharedInvestigationRejected",
)<{
  readonly reason: "Unauthorized" | "Limit" | "Unavailable"
}> {}
export interface SharedInvestigationRow {
  readonly id: string
  readonly creatorId: string
  readonly title: string
  readonly selection: unknown
  readonly createdAt: string
}
