import { Clock, Context, Effect, Layer, Schema } from "effect"
import { InvalidInput, ManagementRateLimited } from "../../errors.js"
import { WaitlistRepository } from "./waitlist-repository.js"

import { WaitlistWelcomeEmail, WaitlistWelcomeError } from "./welcome-email.js"

const Input = Schema.Struct({
  email: Schema.String.check(Schema.isMaxLength(320)),
})
const Email = Schema.String.check(
  Schema.isMaxLength(254),
  Schema.isPattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/),
)

export class JoinWaitlist extends Context.Service<JoinWaitlist>()(
  "@flowmark/api/JoinWaitlist",
  {
    make: Effect.gen(function* () {
      const repository = yield* WaitlistRepository
      const welcome = yield* WaitlistWelcomeEmail
      return {
        join: Effect.fn("JoinWaitlist.join")(function* (raw: unknown) {
          const input = yield* Schema.decodeUnknownEffect(Input)(raw).pipe(
            Effect.mapError(
              () => new InvalidInput({ cause: "Enter a valid email address." }),
            ),
          )
          const email = yield* Schema.decodeUnknownEffect(Email)(
            input.email.trim().toLowerCase(),
          ).pipe(
            Effect.mapError(
              () => new InvalidInput({ cause: "Enter a valid email address." }),
            ),
          )
          const budget = yield* repository.budget()
          if (!budget.allowed) {
            return yield* new ManagementRateLimited({
              retryAfter: budget.retryAfter ?? 60,
            })
          }
          const registration = yield* repository.join(email)
          if (!registration.submitted) {
            // Keep retries inside the provider's 24-hour idempotency retention.
            // An expired uncertain submission requires operator reconciliation.
            const now = yield* Clock.currentTimeMillis
            if (now - registration.startedAt >= 23 * 60 * 60 * 1000) {
              return yield* new WaitlistWelcomeError({
                reason: "retry-window-expired",
              })
            }
            yield* welcome.send(email, registration.id)
            yield* repository.submitWelcome(registration.id)
          }
          return { ok: true as const }
        }),
      }
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make)
}
