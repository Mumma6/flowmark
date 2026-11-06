import { Data } from "effect"

/** Session consent binding rejected before or during persistence (no tokens). */
export class AgentAccessConsentRejected extends Data.TaggedError(
  "AgentAccessConsentRejected",
)<{
  readonly reason: string
}> {}

/** No active delegated connection for the given user, client and grant family. */
export class AgentAccessNotFound extends Data.TaggedError(
  "AgentAccessNotFound",
)<{
  readonly userId: string
  readonly clientId: string
  readonly authorizationCodeId: string
}> {}
