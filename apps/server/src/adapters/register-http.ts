import { Data, Effect, Exit, Schema } from "effect"
import { InvalidInput, logFailure, runApi } from "@flowmark/api"
import { getAuth } from "../auth"
import { readJsonBody } from "./request-body"

class RegistrationUnavailable extends Data.TaggedError(
  "RegistrationUnavailable",
)<{
  readonly cause: unknown
}> {}

const RegisterBody = Schema.Struct({
  name: Schema.optional(Schema.String),
  email: Schema.NonEmptyString,
  password: Schema.String.pipe(Schema.check(Schema.isMinLength(8))),
})

export const handleRegister = Effect.fn("handleRegister")(function* (
  request: Request,
) {
  const json = yield* readJsonBody(request)
  const body = yield* Schema.decodeUnknownEffect(RegisterBody)(json).pipe(
    Effect.mapError((cause) => new InvalidInput({ cause })),
  )
  const name = body.name?.trim() || body.email
  const auth = yield* getAuth()
  const endpoint = new URL(request.url)
  endpoint.pathname = "/api/auth/sign-up/email"
  endpoint.search = ""
  const headers = new Headers(request.headers)
  headers.set("content-type", "application/json")
  headers.delete("content-length")
  const response = yield* Effect.tryPromise({
    try: () =>
      auth.handler(
        new Request(endpoint, {
          method: "POST",
          headers,
          signal: request.signal,
          body: JSON.stringify({
            email: body.email.trim(),
            password: body.password,
            name,
          }),
        }),
      ),
    catch: (cause) => new RegistrationUnavailable({ cause }),
  })
  const forwarded = new Headers({ "cache-control": "no-store" })
  for (const name of ["retry-after", "x-retry-after"]) {
    const value = response.headers.get(name)
    if (value) {
      forwarded.set(name, value)
    }
  }
  // Preserve the existing registration contract. Do not expose provider tokens,
  // account details or raw error messages; the caller signs in separately.
  return response.ok
    ? Response.json({ ok: true as const }, { headers: forwarded })
    : Response.json(
        {
          error:
            response.status === 429
              ? "Too many requests. Please try again later."
              : "Could not create the account.",
        },
        { status: response.status, headers: forwarded },
      )
})

export async function registerOwner(request: Request) {
  const result = await runApi(
    handleRegister(request).pipe(
      Effect.catchTags({
        InvalidInput: () =>
          Effect.succeed(
            Response.json(
              {
                error:
                  "Email and a password of at least 8 characters are required.",
              },
              { status: 400, headers: { "cache-control": "no-store" } },
            ),
          ),
        RegistrationUnavailable: () =>
          Effect.succeed(
            Response.json(
              { error: "Could not create the account." },
              { status: 503, headers: { "cache-control": "no-store" } },
            ),
          ),
        ConfigurationError: () =>
          Effect.succeed(
            Response.json(
              { error: "Could not create the account." },
              { status: 500, headers: { "cache-control": "no-store" } },
            ),
          ),
      }),
    ),
    request.signal,
  )
  return Exit.match(result, {
    onSuccess: (response) => response,
    onFailure: () => {
      logFailure(result)
      return Response.json(
        { error: "Could not create the account." },
        { status: 500, headers: { "cache-control": "no-store" } },
      )
    },
  })
}
