"use client"
import { Context, Data, Effect, Layer, Result, Schema } from "effect"
import { publicConfig } from "../../platform/config-public"

export class EmailChangeClientError extends Data.TaggedError(
  "EmailChangeClientError",
)<{ readonly message: string }> {}
const Change = Schema.Struct({
  id: Schema.String,
  toEmail: Schema.String,
  step: Schema.Literals(["confirm-old", "verify-new", "completed"]),
  delivery: Schema.Literals(["pending", "submitted", "failed"]),
  expiresAt: Schema.String,
})
export const EmailChangeStatus = Schema.Struct({
  userId: Schema.String,
  currentSessionId: Schema.String,
  available: Schema.Boolean,
  verified: Schema.Boolean,
  active: Schema.NullOr(Change),
  notices: Schema.Array(Change),
})
export type EmailChangeStatus = typeof EmailChangeStatus.Type
export class BrowserEmailChange extends Context.Service<
  BrowserEmailChange,
  {
    readonly status: (
      signal?: AbortSignal,
    ) => Effect.Effect<EmailChangeStatus, EmailChangeClientError>
    readonly request: (input: {
      currentSessionId: string
      newEmail: string
      password: string
    }) => Effect.Effect<unknown, EmailChangeClientError>
    readonly cancel: (input: {
      currentSessionId: string
      id: string
    }) => Effect.Effect<unknown, EmailChangeClientError>
    readonly retryNotice: (input: {
      currentSessionId: string
      id: string
    }) => Effect.Effect<unknown, EmailChangeClientError>
  }
>()("@flowmark/dashboard/BrowserEmailChange") {}
const Failure = Schema.Struct({
  message: Schema.String.check(Schema.isMaxLength(500)),
})
const unavailable = () =>
  new EmailChangeClientError({
    message:
      "The request result could not be confirmed. Refresh the status before retrying.",
  })
export const browserEmailChangeLayer = (fetcher: typeof fetch = fetch) => {
  const request = Effect.fn("EmailChange.browserRequest")(function* (
    path: string,
    input?: unknown,
    signal?: AbortSignal,
  ) {
    const response = yield* Effect.tryPromise({
      try: (ownSignal) =>
        fetcher(`${publicConfig.authPath}/email-change/${path}`, {
          method: input === undefined ? "GET" : "POST",
          credentials: "same-origin",
          cache: "no-store",
          redirect: "error",
          headers:
            input === undefined
              ? undefined
              : { "content-type": "application/json" },
          body: input === undefined ? undefined : JSON.stringify(input),
          signal: AbortSignal.any([
            ownSignal,
            AbortSignal.timeout(15_000),
            ...(signal ? [signal] : []),
          ]),
        }),
      catch: unavailable,
    })
    const body = yield* Effect.tryPromise({
      try: () => response.json(),
      catch: unavailable,
    })
    if (!response.ok) {
      const failure = yield* Schema.decodeUnknownEffect(Failure)(body).pipe(
        Effect.mapError(unavailable),
      )
      return yield* new EmailChangeClientError({ message: failure.message })
    }
    return body as unknown
  })
  const acknowledged = (
    path: string,
    key: "requested" | "cancelled" | "submitted",
    input: unknown,
  ) =>
    request(path, input).pipe(
      Effect.flatMap((body) =>
        Schema.decodeUnknownEffect(
          Schema.Record(Schema.String, Schema.Unknown),
        )(body).pipe(Effect.mapError(unavailable)),
      ),
      Effect.flatMap((body) =>
        body[key] === true ? Effect.void : Effect.fail(unavailable()),
      ),
    )
  return Layer.succeed(
    BrowserEmailChange,
    BrowserEmailChange.of({
      status: (signal) =>
        request("status", undefined, signal).pipe(
          Effect.flatMap((body) =>
            Schema.decodeUnknownEffect(EmailChangeStatus)(body).pipe(
              Effect.mapError(unavailable),
            ),
          ),
        ),
      request: (input) => acknowledged("request", "requested", input),
      cancel: (input) => acknowledged("cancel", "cancelled", input),
      retryNotice: (input) => acknowledged("retry-notice", "submitted", input),
    }),
  )
}
/** React Query is the browser execution boundary and receives the original typed error. */
export const runBrowserEmailChange = async <A>(
  effect: Effect.Effect<A, EmailChangeClientError, BrowserEmailChange>,
) => {
  const result = await Effect.runPromise(
    effect.pipe(Effect.provide(browserEmailChangeLayer()), Effect.result),
  )
  return Result.match(result, {
    onSuccess: (value) => value,
    onFailure: (error) => {
      throw error
    },
  })
}
