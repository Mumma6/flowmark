import type { BetterAuthPlugin } from "better-auth"
import { APIError, createAuthMiddleware } from "better-auth/api"
import { Result, Schema } from "effect"

const Payload = Schema.fromJsonString(
  Schema.Struct({ updateTo: Schema.optionalKey(Schema.Unknown) }),
)
/** Untrusted decoding only closes the raw route. Native verification still owns signatures. */
const isChangeProof = (token: unknown) =>
  typeof token === "string" &&
  Result.match(
    Result.try(() =>
      Buffer.from(token.split(".")[1] ?? "", "base64url").toString("utf8"),
    ).pipe(Result.flatMap(Schema.decodeUnknownResult(Payload))),
    {
      onFailure: () => false,
      onSuccess: (payload) => Object.hasOwn(payload, "updateTo"),
    },
  )
export const emailChangeBoundary = (coordinated = false): BetterAuthPlugin => ({
  id: "flowmark-email-change-boundary",
  hooks: {
    before: [
      {
        matcher: (ctx) =>
          ctx.path === "/change-email" || ctx.path === "/verify-email",
        handler: createAuthMiddleware(async (ctx) => {
          if (
            !coordinated &&
            (ctx.path === "/change-email" || isChangeProof(ctx.query?.token))
          ) {
            throw new APIError("FORBIDDEN", {
              message: "Use the coordinated account email-change flow.",
            })
          }
        }),
      },
    ],
  },
})
