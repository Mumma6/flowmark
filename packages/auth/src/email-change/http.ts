import { Array, Cause, Effect, Match, Option, Ref, Schema } from "effect"
import { EmailChangeRejected } from "@flowmark/db/persistence"
import { AccountEmailChange } from "./coordinator.js"
import { AccountEmailError } from "./types.js"
import { Redacted } from "effect"

const RecordId = Schema.String.check(
  Schema.isPattern(
    /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i,
  ),
)
const SessionId = Schema.String.check(
  Schema.isMinLength(1),
  Schema.isMaxLength(256),
)
const RequestInput = Schema.Struct({
  currentSessionId: SessionId,
  newEmail: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(254)),
  password: Schema.String.check(
    Schema.isMinLength(1),
    Schema.isMaxLength(1024),
  ),
})
const RecordInput = Schema.Struct({ currentSessionId: SessionId, id: RecordId })
const ProofInput = Schema.Struct({
  request: RecordId,
  token: Schema.String.check(
    Schema.isMaxLength(4096),
    Schema.isPattern(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/),
  ),
})
const invalid = () => new AccountEmailError({ reason: "InvalidInput" })
const readBody = Effect.fn("EmailChange.readBody")(function* (
  request: Request,
) {
  const state = yield* Ref.make({ bytes: 0, text: "", done: false })
  return yield* Effect.acquireUseRelease(
    Effect.sync(() => request.body?.getReader()),
    (reader) =>
      Effect.gen(function* () {
        if (!reader || Number(request.headers.get("content-length")) > 8192) {
          return yield* invalid()
        }
        const decoder = new TextDecoder()
        yield* Effect.whileLoop({
          while: () => !Ref.getUnsafe(state).done,
          body: () =>
            Effect.gen(function* () {
              const value = yield* Effect.tryPromise({
                try: () => reader.read(),
                catch: invalid,
              })
              const current = yield* Ref.get(state)
              const bytes = current.bytes + (value.value?.byteLength ?? 0)
              if (bytes > 8192) {
                return yield* invalid()
              }
              yield* Ref.set(state, {
                bytes,
                text:
                  current.text +
                  decoder.decode(value.value, { stream: !value.done }),
                done: value.done,
              })
            }),
          step: () => undefined,
        })
        return yield* Schema.decodeUnknownEffect(
          Schema.fromJsonString(Schema.Unknown),
        )((yield* Ref.get(state)).text).pipe(Effect.mapError(invalid))
      }),
    (reader) =>
      reader
        ? Effect.tryPromise({
            try: () => reader.cancel(),
            catch: invalid,
          }).pipe(
            Effect.catchTag("AccountEmailError", () =>
              Effect.logWarning(
                "Could not close account email-change request body",
              ),
            ),
            Effect.ensuring(Effect.sync(() => reader.releaseLock())),
          )
        : Effect.void,
  )
})
const messages = {
  SignInRequired: {
    status: 401,
    message: "Sign in again to manage your email address.",
  },
  NeedsVerification: {
    status: 400,
    message: "Verify your current email before requesting a change.",
  },
  PasswordRejected: {
    status: 400,
    message: "Current password was not accepted.",
  },
  RateLimited: {
    status: 429,
    message: "Too many attempts. Try again in 15 minutes.",
  },
  Changed: {
    status: 409,
    message: "Your sign-in or request changed. Refresh and review again.",
  },
  InvalidInput: {
    status: 400,
    message: "Check the email address, confirmation and current password.",
  },
  InvalidLink: {
    status: 400,
    message: "This link is unavailable, expired or replaced.",
  },
  DeliveryFailed: {
    status: 503,
    message:
      "Mail submission could not be confirmed. Your current email is unchanged until both proofs complete. Refresh the request status before retrying.",
  },
  Unavailable: {
    status: 503,
    message:
      "Email changes are temporarily unavailable. Refresh before retrying.",
  },
} as const
const response = (value: unknown, status = 200) =>
  Response.json(value, {
    status,
    headers: {
      "cache-control": "private, no-store",
      "referrer-policy": "no-referrer",
    },
  })
export const emailChangeHttp = (
  request: Request,
  path: string,
  baseURL: string,
  trustedOrigins: ReadonlyArray<string>,
) =>
  Effect.gen(function* () {
    const service = yield* AccountEmailChange
    if (
      request.headers.has("authorization") ||
      request.headers.has("x-flowmark-grant-client-id")
    ) {
      return response({ message: messages.SignInRequired.message }, 401)
    }
    if (path === "/email-change/status" && request.method === "GET") {
      return response(yield* service.status(request.headers))
    }
    if (path === "/email-change/result" && request.method === "GET") {
      const entry = Array.findFirst(
        (request.headers.get("cookie") ?? "").split(";"),
        (value) => value.trim().startsWith(`${service.receiptCookie}=`),
      )
      const cookie = Option.match(entry, {
        onNone: () => null,
        onSome: (value) => value.trim().slice(service.receiptCookie.length + 1),
      })
      return response({
        result:
          cookie && /^[A-Za-z0-9_-]{43}$/.test(cookie)
            ? yield* service.consumeResult(cookie)
            : null,
      })
    }
    if (path === "/email-change/verify" && request.method === "GET") {
      const url = new URL(request.url)
      const input = yield* Schema.decodeUnknownEffect(ProofInput)({
        request: url.searchParams.get("request"),
        token: url.searchParams.get("token"),
      }).pipe(Effect.mapError(invalid))
      return yield* service.verify(request.headers, input.request, input.token)
    }
    if (
      !Array.contains(
        [
          "/email-change/request",
          "/email-change/cancel",
          "/email-change/retry-notice",
        ],
        path,
      ) ||
      request.method !== "POST"
    ) {
      return response({ message: "Not found." }, 404)
    }
    if (!Array.contains(trustedOrigins, request.headers.get("origin") ?? "")) {
      return response({ message: "A trusted Studio origin is required." }, 403)
    }
    const body = yield* readBody(request)
    if (path === "/email-change/request") {
      const input = yield* Schema.decodeUnknownEffect(RequestInput, {
        onExcessProperty: "error",
      })(body).pipe(Effect.mapError(invalid))
      return response(
        yield* service.request(request.headers, {
          ...input,
          password: Redacted.make(input.password),
        }),
      )
    }
    const input = yield* Schema.decodeUnknownEffect(RecordInput, {
      onExcessProperty: "error",
    })(body).pipe(Effect.mapError(invalid))
    return response(
      yield* path === "/email-change/cancel"
        ? service.cancel(request.headers, input.id, input.currentSessionId)
        : service.retryNotice(
            request.headers,
            input.id,
            input.currentSessionId,
          ),
    )
  })

export const emailChangeHttpFailure = (
  request: Request,
  path: string,
  baseURL: string,
  cause: Cause.Cause<unknown>,
) => {
  if (path === "/email-change/verify") {
    return new Response(null, {
      status: 303,
      headers: {
        location: new URL("/account/email-change", baseURL).href,
        "cache-control": "no-store",
        "referrer-policy": "no-referrer",
      },
    })
  }
  const failure =
    cause.reasons.length === 1 && Cause.isFailReason(cause.reasons[0])
      ? cause.reasons[0].error
      : undefined
  const details = Match.value(failure).pipe(
    Match.when(
      (error: unknown): error is AccountEmailError =>
        error instanceof AccountEmailError,
      (error) => messages[error.reason],
    ),
    Match.when(
      (error: unknown): error is EmailChangeRejected =>
        error instanceof EmailChangeRejected,
      (error) => messages[error.reason],
    ),
    Match.orElse(() => messages.Unavailable),
  )
  return response({ message: details.message }, details.status)
}
