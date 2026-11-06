import { Data } from "effect"

/** Session consent binding rejected before or during persistence (no tokens). */
export class AgentAccessConsentRejected extends Data.TaggedError(
  "AgentAccessConsentRejected",
)<{
  readonly reason: string
}> {}
