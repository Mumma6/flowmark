import { Effect, Layer, Ref } from "effect"
import { Email } from "../service.js"
import { renderEmail } from "../templates.js"
import type { RenderedEmail } from "../message.js"
import { EmailError } from "../errors.js"
import type { EmailEnvironment } from "../config.js"

// Explicit local/test adapter. Bearer links stay in this caller-owned memory;
// never provide it as a hosted fallback or serialize captured messages to logs.
export const makeEmailCapture = Effect.fn("Email.capture")(function* (
  origin = "http://localhost:3000",
  environment: EmailEnvironment = "local",
) {
  const messages = yield* Ref.make<readonly RenderedEmail[]>([])
  const service = Email.of({
    send: Effect.fn("Email.capture.send")(function* (input: unknown) {
      const message = yield* renderEmail(input, origin, environment)
      const conflict = yield* Ref.modify(messages, (current) => {
        const previous = current.find(
          (entry) => entry.idempotencyKey === message.idempotencyKey,
        )
        return previous
          ? ([
              JSON.stringify(previous) !== JSON.stringify(message),
              current,
            ] as const)
          : ([false, [...current, message]] as const)
      })
      if (conflict) {
        return yield* new EmailError({
          operation: "validation",
          reason: "idempotency-conflict",
        })
      }
      return {
        status: "submitted" as const,
        providerId: `capture/${message.idempotencyKey}`,
      }
    }),
  })
  return {
    layer: Layer.succeed(Email, service),
    read: Ref.get(messages),
    clear: Ref.set(messages, []),
  }
})
