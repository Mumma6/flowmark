import { Context, type Effect, type Option, type Redacted } from "effect"
import type {
  InvalidInput,
  ManagementRateLimited,
  PersistenceError,
  Unauthorized,
} from "../../../errors.js"
import type { InvitationReview, ProjectSharingDetails } from "../contracts.js"
export type SharingError =
  InvalidInput | ManagementRateLimited | PersistenceError | Unauthorized
export type InvitationDispatch = {
  readonly id: string
  readonly email: string
  readonly projectName: string
  readonly inviterName: string
}
export class ProjectSharingRepository extends Context.Service<
  ProjectSharingRepository,
  {
    readonly list: (
      userId: string,
      projectId: string,
    ) => Effect.Effect<ProjectSharingDetails, SharingError>
    readonly invite: (
      userId: string,
      projectId: string,
      email: string,
      tokenHash: string,
    ) => Effect.Effect<Option.Option<InvitationDispatch>, SharingError>
    readonly delivery: (
      id: string,
      hash: string,
      status: "submitted" | "failed",
    ) => Effect.Effect<void, SharingError>
    readonly review: (
      userId: string,
      id: string,
      hash: string,
      action: "review" | "accept" | "decline",
    ) => Effect.Effect<InvitationReview, SharingError>
    readonly remove: (
      userId: string,
      projectId: string,
      targetId: string,
    ) => Effect.Effect<{ readonly removed: true }, SharingError>
    readonly revoke: (
      userId: string,
      projectId: string,
      id: string,
    ) => Effect.Effect<{ readonly revoked: true }, SharingError>
    readonly budget: (
      hash: string,
      window: number,
      max: number,
    ) => Effect.Effect<{ readonly allowed: boolean }, SharingError>
    readonly prune: () => Effect.Effect<unknown, SharingError>
  }
>()("@flowmark/api/ProjectSharingRepository") {}
export type SharingIdentity = {
  readonly userId: string
  readonly sessionId: string
}
export class ProjectSharingIdentity extends Context.Service<
  ProjectSharingIdentity,
  {
    readonly current: Effect.Effect<SharingIdentity, SharingError>
    readonly confirm: (
      password: Redacted.Redacted<string>,
    ) => Effect.Effect<SharingIdentity, SharingError>
  }
>()("@flowmark/api/ProjectSharingIdentity") {}
export class ProjectInvitationDelivery extends Context.Service<
  ProjectInvitationDelivery,
  {
    readonly recipientKey: (
      email: string,
    ) => Effect.Effect<string, SharingError>
    readonly send: (
      message: InvitationDispatch,
      token: Redacted.Redacted<string>,
    ) => Effect.Effect<void, SharingError>
  }
>()("@flowmark/api/ProjectInvitationDelivery") {}
