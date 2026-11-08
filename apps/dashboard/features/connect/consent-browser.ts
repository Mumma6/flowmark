import { Data, Effect, Schema } from "effect"

export class ConsentHttpError extends Data.TaggedError("ConsentHttpError")<{
  readonly status: number
  readonly reason: string
}> {}

const ConsentView = Schema.Struct({
  clientId: Schema.String,
  clientName: Schema.NullOr(Schema.String),
  account: Schema.Struct({ id: Schema.String, email: Schema.String }),
  accountBinding: Schema.String,
  scopes: Schema.Array(Schema.String),
  projects: Schema.Array(
    Schema.Struct({ id: Schema.String, name: Schema.String }),
  ),
})
export type ConsentView = typeof ConsentView.Type
const Redirect = Schema.Struct({ redirect: Schema.URLFromString })

const requestJson = Effect.fn("ConsentBrowser.request")(function* (
  path: string,
  init?: RequestInit,
) {
  const response = yield* Effect.tryPromise({
    try: (signal) => fetch(path, { ...init, signal, cache: "no-store" }),
    catch: () =>
      new ConsentHttpError({
        status: 503,
        reason: "Authorization is temporarily unavailable. Please retry.",
      }),
  })
  if (!response.ok) {
    return yield* new ConsentHttpError({
      status: response.status,
      reason:
        response.status === 401
          ? "Sign in to review this request."
          : "The request is stale, the account changed, or authorization is unavailable. Reload or restart from your client.",
    })
  }
  return yield* Effect.tryPromise({
    try: () => response.json(),
    catch: () =>
      new ConsentHttpError({
        status: 503,
        reason: "The authorization response could not be read.",
      }),
  })
})

export const readConsentView = (oauthQuery: string, signal: AbortSignal) =>
  Effect.runPromise(
    requestJson(
      `/api/agent-consent?${new URLSearchParams({ oauth_query: oauthQuery })}`,
    ).pipe(Effect.flatMap(Schema.decodeUnknownEffect(ConsentView))),
    { signal },
  )

export const submitConsentView = (input: {
  readonly oauthQuery: string
  readonly accountBinding: string
  readonly accept: boolean
  readonly projectIds: readonly string[]
}) =>
  requestJson("/api/agent-consent", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  }).pipe(
    Effect.flatMap(Schema.decodeUnknownEffect(Redirect)),
    Effect.filterOrFail(
      ({ redirect }) =>
        !redirect.username &&
        !redirect.password &&
        (redirect.protocol === "https:" ||
          (redirect.protocol === "http:" &&
            ["localhost", "127.0.0.1", "[::1]"].includes(redirect.hostname))),
      () =>
        new ConsentHttpError({
          status: 400,
          reason:
            "The client callback is not supported. Restart authorization.",
        }),
    ),
    Effect.map(({ redirect }) => redirect.href),
  )
