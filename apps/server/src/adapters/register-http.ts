import { Effect, Exit, Schema } from "effect"
import { InvalidInput, logFailure, runApi } from "@flowmark/api"
import { APIError } from "better-auth/api"
import { Data } from "effect"
import { getAuth } from "../auth"
import { readJsonBody } from "./request-body"

class AuthConflict extends Data.TaggedError("AuthConflict")<{
  readonly cause: unknown
}> {}

const RegisterBody = Schema.Struct({
  name: Schema.optional(Schema.String),
  email: Schema.NonEmptyString,
  password: Schema.String.pipe(Schema.minLength(8)),
})

export const handleRegister = Effect.fn("handleRegister")(function* (
  request: Request,
) {
  const json = yield* readJsonBody(request)
  const body = yield* Schema.decodeUnknown(RegisterBody)(json).pipe(
    Effect.mapError((cause) => new InvalidInput({ cause })),
  )
  const name = body.name?.trim() || body.email
  const auth = yield* getAuth()
  yield* Effect.tryPromise({
    try: () =>
      auth.api.signUpEmail({
        body: {
          email: body.email.trim(),
          password: body.password,
          name,
        },
      }),
    catch: (cause) =>
      cause instanceof APIError
        ? new AuthConflict({ cause })
        : new InvalidInput({ cause }),
  })
  return Response.json({ ok: true as const })
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
              { status: 400 },
            ),
          ),
        AuthConflict: (error) =>
          Effect.succeed(
            Response.json(
              {
                error:
                  error.cause instanceof Error
                    ? error.cause.message
                    : "Could not create the account.",
              },
              { status: 409 },
            ),
          ),
        ConfigurationError: () =>
          Effect.succeed(
            Response.json(
              { error: "Could not create the account." },
              { status: 500 },
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
        { status: 500 },
      )
    },
  })
}
