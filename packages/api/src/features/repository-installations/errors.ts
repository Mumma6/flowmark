import { Data } from "effect"

export type RepositoryInstallationRejectionReason =
  | "installation-not-found"
  | "installation-revoked"
  | "invalid-signature"
  | "stale-event"
  | "foreign-repository"
  | "grant-narrowed"
  | "policy-escalation-rejected"
  | "secret-leak-blocked"
  | "host-unconfigured"
  | "verification-failed"

export class RepositoryInstallationRejected extends Data.TaggedError(
  "RepositoryInstallationRejected",
)<{
  readonly reason: RepositoryInstallationRejectionReason
  readonly detail: string
}> {}
