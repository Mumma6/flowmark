import { Context, Effect, Layer, Schema } from "effect"
import { InvalidInput, ManagementRateLimited } from "../../errors.js"
import { WaitlistRepository } from "./waitlist-repository.js"

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
          yield* repository.join(email)
          return { ok: true as const }
        }),
      }
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make)
}
