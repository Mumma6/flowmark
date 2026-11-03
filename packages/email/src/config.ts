import { Effect, Match, Redacted, Schema } from "effect"
import { EmailError } from "./errors.js"
import { Mailbox } from "./message.js"

export const EmailEnvironment = Schema.Literals([
  "production",
  "staging",
  "preview",
  "local",
])
export type EmailEnvironment = typeof EmailEnvironment.Type

export const emailEnvironmentLabel = (environment: EmailEnvironment) =>
  Match.value(environment).pipe(
    Match.when("production", () => "Production"),
    Match.when("staging", () => "Staging"),
    Match.when("preview", () => "Preview"),
    Match.when("local", () => "Local"),
    Match.exhaustive,
  )

const Settings = Schema.Struct({
  RESEND_API_KEY: Schema.String.check(Schema.isPattern(/^re_[A-Za-z0-9_-]+$/)),
  FLOWMARK_EMAIL_FROM: Mailbox,
  FLOWMARK_EMAIL_REPLY_TO: Mailbox,
  BETTER_AUTH_URL: Schema.String,
  FLOWMARK_EMAIL_ENVIRONMENT: EmailEnvironment,
})

export const canonicalEmailOrigin = (origin: string) =>
  Effect.try({
    try: () => {
      const url = new URL(origin)
      const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(
        url.hostname,
      )
      if (
        (url.protocol !== "https:" &&
          !(url.protocol === "http:" && loopback)) ||
        url.username ||
        url.password ||
        url.pathname !== "/" ||
        url.search ||
        url.hash
      ) {
        throw new Error("Invalid canonical origin")
      }
      return url.origin
    },
    catch: () =>
      new EmailError({
        operation: "configuration",
        reason: "invalid-configuration",
      }),
  })

export const emailSettings = Effect.fn("Email.settings")(function* (
  env: Readonly<Record<string, string | undefined>>,
) {
  const decoded = yield* Schema.decodeUnknownEffect(Settings)(env).pipe(
    Effect.mapError(
      () =>
        new EmailError({
          operation: "configuration",
          reason: "invalid-configuration",
        }),
    ),
  )
  const origin = yield* canonicalEmailOrigin(decoded.BETTER_AUTH_URL)
  return {
    apiKey: Redacted.make(decoded.RESEND_API_KEY),
    from: decoded.FLOWMARK_EMAIL_FROM,
    replyTo: decoded.FLOWMARK_EMAIL_REPLY_TO,
    origin,
    environment: decoded.FLOWMARK_EMAIL_ENVIRONMENT,
  }
})
