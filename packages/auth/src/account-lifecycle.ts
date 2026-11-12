import type { BetterAuthPlugin } from "better-auth"
import {
  APIError,
  createAuthMiddleware,
  getSessionFromCtx,
} from "better-auth/api"
import { Data, Effect, Exit } from "effect"
import type { FlowmarkDatabase } from "@flowmark/db"
import { Database, isAccountActive } from "@flowmark/db/persistence"

class AccountLifecycleAuthError extends Data.TaggedError(
  "AccountLifecycleAuthError",
)<{ readonly cause: unknown }> {}

/** The same provider hook pipeline protects HTTP and direct server API calls. */
export const accountLifecycle = (db: FlowmarkDatabase): BetterAuthPlugin => ({
  id: "flowmark-account-lifecycle",
  hooks: {
    before: [
      {
        matcher: () => true,
        handler: createAuthMiddleware(async (ctx) => {
          if (
            ctx.path === "/delete-user" ||
            ctx.path === "/delete-user/callback"
          ) {
            throw new APIError("FORBIDDEN", {
              message: "Use the coordinated Data & privacy deletion flow.",
            })
          }
          if (!ctx.headers?.get("cookie") || ctx.path === "/sign-out") {
            return
          }
          const admitted = await Effect.runPromiseExit(
            Effect.gen(function* () {
              const identity = yield* Effect.tryPromise({
                try: () =>
                  getSessionFromCtx(ctx, {
                    disableCookieCache: true,
                    disableRefresh: true,
                  }),
                catch: (cause) => new AccountLifecycleAuthError({ cause }),
              })
              if (!identity) {
                return true
              }
              return yield* isAccountActive(identity.user.id).pipe(
                Effect.provideService(Database, db),
              )
            }),
          )
          Exit.match(admitted, {
            onFailure: () => {
              throw new APIError("SERVICE_UNAVAILABLE", {
                message: "Account access is temporarily unavailable.",
              })
            },
            onSuccess: (active) => {
              if (!active) {
                throw new APIError("UNAUTHORIZED", {
                  message: "Account access is unavailable during cleanup.",
                })
              }
            },
          })
        }),
      },
    ],
  },
})
