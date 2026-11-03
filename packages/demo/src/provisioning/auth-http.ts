import { Effect, Ref } from "effect"
import { DatasetConflict } from "@flowmark/db/fixtures"
import type { AuthHttp } from "./account.js"

/** Cookies and password stay in memory. No provider response, header or URL with tokens is logged. */
export const makeAuthHttp = Effect.fn("Meridian.makeAuthHttp")(function* (
  origin: string,
  send: (request: Request) => Promise<Response> = fetch,
) {
  if (
    !["https://app.staging.flowmark.dev", "http://localhost:3001"].includes(
      origin,
    )
  ) {
    return yield* new DatasetConflict({
      reason:
        "Authentication is restricted to canonical Staging or local dashboard origins.",
    })
  }
  const cookies = yield* Ref.make<Record<string, string>>({})
  return {
    request: Effect.fn("Meridian.authRequest")(function* (
      path: string,
      body?: object,
    ) {
      if (
        !["/sign-up/email", "/sign-in/email", "/get-session"].includes(path)
      ) {
        return yield* new DatasetConflict({
          reason: "Unsupported provisioning auth operation.",
        })
      }
      const cookie = Object.values(yield* Ref.get(cookies)).join("; ")
      const response = yield* Effect.tryPromise({
        try: () =>
          send(
            new Request(`${origin}/api/auth${path}`, {
              method: body ? "POST" : "GET",
              headers: {
                origin,
                "content-type": "application/json",
                ...(cookie ? { cookie } : {}),
              },
              ...(body ? { body: JSON.stringify(body) } : {}),
              redirect: "error",
              signal: AbortSignal.timeout(30000),
            }),
          ),
        catch: () =>
          new DatasetConflict({
            reason:
              "Authentication request failed. Inspect the service without exposing credentials.",
          }),
      })
      if (!response.ok) {
        return yield* new DatasetConflict({
          reason: `Authentication was rejected (HTTP ${response.status}). Existing credentials and email verification were not changed.`,
        })
      }
      yield* Ref.update(cookies, (existing) => ({
        ...existing,
        ...Object.fromEntries(
          response.headers.getSetCookie().map((value) => {
            const pair = value.split(";")[0]!
            return [pair.slice(0, pair.indexOf("=")), pair]
          }),
        ),
      }))
      return yield* Effect.tryPromise({
        try: () => response.json() as Promise<unknown>,
        catch: () =>
          new DatasetConflict({ reason: "Invalid authentication response." }),
      })
    }),
  } satisfies AuthHttp
})
