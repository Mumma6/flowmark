import type { BetterAuthPlugin } from "better-auth"
import { APIError, createAuthMiddleware } from "better-auth/api"
import { Data, Effect, Exit } from "effect"
import { AUTH_CLIENT_IP_HEADER } from "./client-identity.js"
import type { createAuthRateLimitStorage } from "./rate-limit-storage.js"

class AuthLimitStorageError extends Data.TaggedError("AuthLimitStorageError")<{
  readonly cause: unknown
}> {}

const policies = {
  "/sign-in/email": { kind: "login", window: 60, max: 10 },
  "/sign-up/email": { kind: "signup", window: 900, max: 5 },
  "/request-password-reset": { kind: "recovery", window: 900, max: 3 },
  "/send-verification-email": { kind: "verification", window: 900, max: 3 },
} as const

export function accountRateLimits(
  storage: ReturnType<typeof createAuthRateLimitStorage>,
): BetterAuthPlugin {
  return {
    id: "flowmark-account-rate-limits",
    hooks: {
      before: [
        {
          matcher: (ctx) =>
            !!ctx.path &&
            (ctx.path in policies ||
              ctx.path === "/oauth2/authorize" ||
              ctx.path === "/oauth2/token"),
          handler: createAuthMiddleware(async (ctx) => {
            if (
              ctx.path === "/oauth2/authorize" ||
              ctx.path === "/oauth2/token"
            ) {
              const operation =
                ctx.path === "/oauth2/authorize" ? "authorize" : "token"
              const source =
                ctx.headers?.get(AUTH_CLIENT_IP_HEADER) ??
                "unattributed-service"
              const consumed = await Effect.runPromiseExit(
                Effect.tryPromise({
                  try: () =>
                    storage.consumeAgent(`agent-oauth:${operation}:${source}`, {
                      window: 60,
                      max: operation === "authorize" ? 60 : 120,
                    }),
                  catch: (cause) => new AuthLimitStorageError({ cause }),
                }),
              )
              const decision = Exit.match(consumed, {
                onSuccess: (value) => value,
                onFailure: () => {
                  throw new APIError("SERVICE_UNAVAILABLE", {
                    message: "Authorization admission is unavailable.",
                  })
                },
              })
              if (!decision.allowed) {
                throw new APIError(
                  "TOO_MANY_REQUESTS",
                  { message: "Authorization budget exhausted." },
                  { "Retry-After": String(decision.retryAfter) },
                )
              }
              return
            }
            const policy = policies[ctx.path as keyof typeof policies]
            const email =
              typeof ctx.body?.email === "string"
                ? ctx.body.email.trim().toLowerCase()
                : ""
            if (!email) {
              return
            }
            if (email.length > 320) {
              throw new APIError("BAD_REQUEST", { message: "Invalid email." })
            }
            // Same counter for existing and unknown addresses, before any lookup.
            const consumed = await Effect.runPromiseExit(
              Effect.gen(function* () {
                const consume = (
                  key: string,
                  rule: { readonly window: number; readonly max: number },
                ) =>
                  Effect.tryPromise({
                    try: () => storage.consume(key, rule),
                    catch: (cause) => new AuthLimitStorageError({ cause }),
                  })
                if (policy.kind !== "login") {
                  const service = yield* consume(`service:${policy.kind}`, {
                    window: 900,
                    max: policy.kind === "signup" ? 25 : 100,
                  })
                  if (!service.allowed) {
                    return service
                  }
                }
                return yield* consume(`account:${policy.kind}:${email}`, policy)
              }),
            )
            const result = Exit.match(consumed, {
              onSuccess: (value) => value,
              onFailure: () => {
                throw new APIError("SERVICE_UNAVAILABLE", {
                  message: "Authentication is temporarily unavailable.",
                })
              },
            })
            if (!result.allowed) {
              throw new APIError(
                "TOO_MANY_REQUESTS",
                {
                  message: "Too many requests. Please try again later.",
                },
                {
                  "Retry-After": String(result.retryAfter),
                  "X-Retry-After": String(result.retryAfter),
                },
              )
            }
          }),
        },
      ],
    },
  }
}
