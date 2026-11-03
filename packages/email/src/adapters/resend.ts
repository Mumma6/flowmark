import { Effect, Layer, Redacted, Schema } from "effect"
import { emailSettings, emailEnvironmentLabel } from "../config.js"
import { EmailError } from "../errors.js"
import { Email } from "../service.js"
import { renderEmail } from "../templates.js"

const Submission = Schema.Struct({
  id: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(256)),
})

// Capture fetch at composition, not through mutable global state. The full
// request and response-body lifetime is bounded and aborted on interruption.
export const resendLayer = (
  env: Readonly<Record<string, string | undefined>>,
  fetcher: typeof fetch = globalThis.fetch,
) =>
  Layer.effect(
    Email,
    Effect.gen(function* () {
      const settings = yield* emailSettings(env)
      return Email.of({
        send: Effect.fn("Email.submit")(function* (input: unknown) {
          const message = yield* renderEmail(
            input,
            settings.origin,
            settings.environment,
          )
          return yield* Effect.scoped(
            Effect.gen(function* () {
              const controller = yield* Effect.acquireRelease(
                Effect.sync(() => new AbortController()),
                (controller) => Effect.sync(() => controller.abort()),
              )
              const response = yield* Effect.tryPromise({
                try: () =>
                  fetcher("https://api.resend.com/emails", {
                    method: "POST",
                    redirect: "error",
                    signal: controller.signal,
                    headers: {
                      Authorization: `Bearer ${Redacted.value(settings.apiKey)}`,
                      "Content-Type": "application/json",
                      "Idempotency-Key": message.idempotencyKey,
                    },
                    body: JSON.stringify({
                      from: `${settings.environment === "production" ? "Flowmark" : `Flowmark ${emailEnvironmentLabel(settings.environment)}`} <${settings.from}>`,
                      reply_to: settings.replyTo,
                      to: [message.to],
                      subject: message.subject,
                      text: message.text,
                      html: message.html,
                      tags: [
                        { name: "environment", value: settings.environment },
                      ],
                    }),
                  }),
                catch: () =>
                  new EmailError({
                    operation: "submission",
                    reason: "network",
                  }),
              })
              if (!response.ok) {
                // Never read a provider error body: it can echo sensitive input.
                yield* Effect.tryPromise({
                  try: () => response.body?.cancel() ?? Promise.resolve(),
                  catch: () =>
                    new EmailError({
                      operation: "submission",
                      reason: "rejected",
                      status: response.status,
                    }),
                })
                return yield* new EmailError({
                  operation: "submission",
                  reason: "rejected",
                  status: response.status,
                })
              }
              const body = yield* Effect.tryPromise({
                try: () => response.json(),
                catch: () =>
                  new EmailError({
                    operation: "submission",
                    reason: "invalid-response",
                  }),
              })
              const submitted = yield* Schema.decodeUnknownEffect(Submission)(
                body,
              ).pipe(
                Effect.mapError(
                  () =>
                    new EmailError({
                      operation: "submission",
                      reason: "invalid-response",
                    }),
                ),
              )
              return { status: "submitted" as const, providerId: submitted.id }
            }),
          ).pipe(
            Effect.timeoutOrElse({
              duration: "10 seconds",
              orElse: () =>
                Effect.fail(
                  new EmailError({
                    operation: "submission",
                    reason: "timeout",
                  }),
                ),
            }),
          )
        }),
      })
    }),
  )
