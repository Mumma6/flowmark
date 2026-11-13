import { createHash, randomBytes } from "node:crypto"
import {
  Context,
  Effect,
  Layer,
  Option,
  Redacted,
  Result,
  String,
  pipe,
} from "effect"
import {
  InvalidInput,
  ManagementRateLimited,
  Unauthorized,
} from "../../../errors.js"
import {
  ProjectInvitationDelivery,
  ProjectSharingIdentity,
  ProjectSharingRepository,
} from "../ports/project-sharing.js"
import type {
  InviteProjectSchema,
  ReviewInvitationSchema,
} from "../contracts.js"

const hash = (value: string) => createHash("sha256").update(value).digest("hex")
const identityMatches = (
  userId: string,
  sessionId: string,
  actor: { userId: string; sessionId: string },
) =>
  actor.userId === userId && actor.sessionId === sessionId
    ? Effect.void
    : Effect.fail(new Unauthorized({ permission: "write" }))
export class ManageProjectSharing extends Context.Service<ManageProjectSharing>()(
  "@flowmark/api/ManageProjectSharing",
  {
    make: Effect.gen(function* () {
      const repository = yield* ProjectSharingRepository
      const budget = Effect.fn("ProjectSharing.budget")(function* (
        key: string,
        window: number,
        max: number,
      ) {
        if (!(yield* repository.budget(hash(key), window, max)).allowed) {
          return yield* new ManagementRateLimited({ retryAfter: window })
        }
      })
      const currentUser = Effect.fn("ProjectSharing.currentUser")(function* (
        userId: string,
      ) {
        const identity = yield* ProjectSharingIdentity
        if ((yield* identity.current).userId !== userId) {
          return yield* new Unauthorized({ permission: "read" })
        }
      })
      return {
        list: Effect.fn("ProjectSharing.list")(function* (
          userId: string,
          projectId: string,
        ) {
          yield* currentUser(userId)
          return yield* repository.list(userId, projectId)
        }),
        remove: Effect.fn("ProjectSharing.remove")(function* (
          userId: string,
          projectId: string,
          targetId: string,
        ) {
          yield* currentUser(userId)
          return yield* repository.remove(userId, projectId, targetId)
        }),
        revoke: Effect.fn("ProjectSharing.revoke")(function* (
          userId: string,
          projectId: string,
          id: string,
        ) {
          yield* currentUser(userId)
          return yield* repository.revoke(userId, projectId, id)
        }),
        invite: Effect.fn("ProjectSharing.invite")(function* (
          userId: string,
          input: typeof InviteProjectSchema.Type,
        ) {
          const identity = yield* ProjectSharingIdentity
          yield* identityMatches(
            userId,
            input.currentSessionId,
            yield* identity.current,
          )
          yield* budget(`sharing-password:${userId}`, 900, 5)
          yield* identityMatches(
            userId,
            input.currentSessionId,
            yield* identity.confirm(Redacted.make(input.password)),
          )
          // Authorize before consuming target-recipient buckets or doing any delivery work.
          const details = yield* repository.list(userId, input.projectId)
          if (details.role !== "owner") {
            return yield* new Unauthorized({ permission: "write" })
          }
          const email = pipe(input.email, String.trim, String.toLowerCase)
          const delivery = yield* ProjectInvitationDelivery
          const recipientKey = yield* delivery.recipientKey(email)
          yield* budget(`sharing-invites:${userId}:${input.projectId}`, 900, 10)
          yield* budget(`sharing-daily:${userId}:${input.projectId}`, 86400, 50)
          yield* budget(`sharing-recipient:${recipientKey}`, 3600, 3)
          yield* repository.prune()
          const token = yield* Effect.sync(() =>
            randomBytes(32).toString("base64url"),
          )
          const tokenHash = hash(token)
          const dispatch = yield* repository.invite(
            userId,
            input.projectId,
            email,
            tokenHash,
            input.role ?? "viewer",
          )
          yield* Option.match(dispatch, {
            onNone: () => Effect.void,
            onSome: (message) =>
              Effect.gen(function* () {
                const sent = yield* delivery
                  .send(message, Redacted.make(token))
                  .pipe(Effect.result)
                yield* repository.delivery(
                  message.id,
                  tokenHash,
                  Result.match(sent, {
                    onFailure: () => "failed" as const,
                    onSuccess: () => "submitted" as const,
                  }),
                )
                return yield* Result.match(sent, {
                  onSuccess: () => Effect.void,
                  onFailure: () =>
                    Effect.fail(
                      new InvalidInput({
                        cause:
                          "Invitation recorded, but mail submission could not be confirmed. Review pending invitations before retrying.",
                      }),
                    ),
                })
              }),
          })
          return { requested: true as const }
        }),
        review: Effect.fn("ProjectSharing.review")(function* (
          userId: string,
          input: typeof ReviewInvitationSchema.Type,
        ) {
          const identity = yield* ProjectSharingIdentity
          yield* identityMatches(
            userId,
            input.currentSessionId,
            yield* identity.current,
          )
          yield* budget(`sharing-proof:${userId}`, 60, 30)
          return yield* repository.review(
            userId,
            input.id,
            hash(input.token),
            input.action,
          )
        }),
      }
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make)
}
