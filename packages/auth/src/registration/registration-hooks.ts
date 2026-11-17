import type { BetterAuthOptions } from "better-auth"
import { APIError } from "better-auth/api"
import { Effect, Exit, Option } from "effect"
import type { FlowmarkDatabase } from "@flowmark/db"
import { Database, RegistrationInvitationStore } from "@flowmark/db/persistence"
import {
  hashInvitationToken,
  REGISTRATION_INVITE_HEADER,
  validInvitationToken,
} from "./invitation-token.js"

/** Provider database hooks also guard direct auth.api calls and future signup paths. */
export const registrationHooks = (
  db: FlowmarkDatabase,
  inviteOnly: boolean,
): BetterAuthOptions["databaseHooks"] => {
  const run = <A, E>(
    effect: Effect.Effect<A, E, RegistrationInvitationStore>,
  ) =>
    Effect.runPromiseExit(
      effect.pipe(
        Effect.provide(RegistrationInvitationStore.layer),
        Effect.provideService(Database, db),
      ),
    )
  return {
    user: {
      create: {
        before: async (user, ctx) => {
          if (!inviteOnly) {
            return
          }
          const token = ctx?.headers?.get(REGISTRATION_INVITE_HEADER)
          if (!validInvitationToken(token)) {
            throw new APIError("FORBIDDEN", {
              message: "A valid invitation is required to register.",
            })
          }
          const result = await run(
            Effect.gen(function* () {
              const invitations = yield* RegistrationInvitationStore
              return yield* invitations.get(
                user.email,
                hashInvitationToken(token),
              )
            }),
          )
          Exit.match(result, {
            onFailure: () => {
              throw new APIError("SERVICE_UNAVAILABLE", {
                message: "Registration is temporarily unavailable.",
              })
            },
            onSuccess: (invitation) => {
              if (Option.isNone(invitation)) {
                throw new APIError("FORBIDDEN", {
                  message: "A valid invitation is required to register.",
                })
              }
            },
          })
        },
        after: async (user, ctx) => {
          const token = ctx?.headers?.get(REGISTRATION_INVITE_HEADER)
          if (!inviteOnly || !validInvitationToken(token)) {
            return
          }
          const result = await run(
            Effect.gen(function* () {
              const invitations = yield* RegistrationInvitationStore
              yield* invitations.remove(user.email, hashInvitationToken(token))
            }),
          )
          Exit.match(result, {
            onSuccess: () => undefined,
            onFailure: () => {
              throw new APIError("SERVICE_UNAVAILABLE", {
                message: "Registration is temporarily unavailable.",
              })
            },
          })
        },
      },
    },
  }
}
