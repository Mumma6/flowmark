import { createHash } from "node:crypto"
import type { OAuthProviderExtension } from "@better-auth/oauth-provider"
import { Effect, Match, Schema } from "effect"
import { AgentAccessContractError } from "./contract-errors.js"

/** Same SHA-256/base64url storage format as the pinned OAuth provider. */
export const hashOAuthToken = (token: string) =>
  createHash("sha256").update(token).digest("base64url")

const TokenRequest = Schema.Union([
  Schema.Struct({
    grant_type: Schema.Literal("authorization_code"),
    code: Schema.NonEmptyString,
  }),
  Schema.Struct({
    grant_type: Schema.Literal("refresh_token"),
    refresh_token: Schema.NonEmptyString,
  }),
])

const RefreshFamily = Schema.Struct({
  authorizationCodeId: Schema.NonEmptyString,
  userId: Schema.NonEmptyString,
  clientId: Schema.NonEmptyString,
})

/** Provider claim callback: runs after the provider validates the code/refresh token. */
export const flowmarkGrantFamilyClaims = {
  claims: {
    accessToken: ({ ctx, user, client }) =>
      Effect.runPromise(
        Effect.gen(function* () {
          const request = yield* Schema.decodeUnknownEffect(TokenRequest)(
            ctx.body,
          ).pipe(
            Effect.mapError(
              (cause) =>
                new AgentAccessContractError({
                  reason: "Delegated token request is invalid.",
                  cause,
                }),
            ),
          )
          const familyId = yield* Match.value(request).pipe(
            Match.when({ grant_type: "authorization_code" }, ({ code }) =>
              Effect.succeed(hashOAuthToken(code)),
            ),
            Match.when({ grant_type: "refresh_token" }, ({ refresh_token }) =>
              Effect.tryPromise({
                try: () =>
                  ctx.context.adapter.findOne({
                    model: "oauthRefreshToken",
                    where: [
                      { field: "token", value: hashOAuthToken(refresh_token) },
                    ],
                  }),
                catch: (cause) =>
                  new AgentAccessContractError({
                    reason: "Delegated token family could not be read.",
                    cause,
                  }),
              }).pipe(
                Effect.flatMap((row) =>
                  Schema.decodeUnknownEffect(RefreshFamily)(row),
                ),
                Effect.mapError(
                  (cause) =>
                    new AgentAccessContractError({
                      reason: "Delegated token family is unavailable.",
                      cause,
                    }),
                ),
                Effect.filterOrFail(
                  (row) =>
                    row.userId === user?.id && row.clientId === client.clientId,
                  () =>
                    new AgentAccessContractError({
                      reason:
                        "Delegated token family does not match the caller.",
                    }),
                ),
                Effect.map((row) => row.authorizationCodeId),
              ),
            ),
            Match.exhaustive,
          )
          return { flowmark_grant_family: familyId }
        }),
      ),
  },
} satisfies OAuthProviderExtension
