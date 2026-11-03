import { Effect } from "effect"
import { Email, EmailError, resendLayer } from "../index.js"

// Explicit, one-message Staging check. No account action is claimed, no token
// links are mailed, and the caller must preserve the UUID for any retry.
const program = Effect.gen(function* () {
  const [send, toFlag, to, idFlag, messageId, ...extra] = process.argv.slice(2)
  if (
    send !== "--send" ||
    toFlag !== "--to" ||
    idFlag !== "--message-id" ||
    extra.length !== 0
  ) {
    return yield* new EmailError({
      operation: "validation",
      reason: "invalid-message",
    })
  }
  if (
    process.env.BETTER_AUTH_URL !== "https://app.staging.flowmark.dev" ||
    process.env.FLOWMARK_EMAIL_ENVIRONMENT !== "staging"
  ) {
    return yield* new EmailError({
      operation: "configuration",
      reason: "invalid-configuration",
    })
  }
  const email = yield* Email
  const result = yield* email.send({ kind: "delivery-test", to, messageId })
  yield* Effect.sync(() => console.log(JSON.stringify(result)))
}).pipe(
  Effect.provide(resendLayer(process.env)),
  Effect.catchTag("EmailError", (error) =>
    Effect.sync(() => {
      console.error(
        `Email check failed: ${error.operation}/${error.reason}${error.status ? ` (HTTP ${error.status})` : ""}. No automatic retry. Preserve the message ID.`,
      )
      process.exitCode = 1
    }),
  ),
  Effect.catchCause(() =>
    Effect.sync(() => {
      console.error(
        "Email check interrupted or failed unexpectedly. No automatic retry.",
      )
      process.exitCode = 1
    }),
  ),
)

await Effect.runPromise(program)
