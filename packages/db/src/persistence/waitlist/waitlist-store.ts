import { Context, Effect, Layer } from "effect"
import {
  Database,
  DatabaseCancellation,
  provideDatabase,
  type DatabaseError,
} from "../database.js"
import { consumeAuthRateLimit } from "../auth/writes/consume-auth-rate-limit.js"
import { joinWaitlist } from "./writes/join-waitlist.js"

interface WaitlistStoreService {
  readonly join: (email: string) => Effect.Effect<void, DatabaseError>
  readonly budget: (
    key: string,
  ) => Effect.Effect<
    { readonly allowed: boolean; readonly retryAfter: number | null },
    DatabaseError
  >
}
export class WaitlistStore extends Context.Service<WaitlistStore>()(
  "@flowmark/db/WaitlistStore",
  {
    make: Effect.gen(function* () {
      const provide = provideDatabase(
        yield* Database,
        yield* DatabaseCancellation,
      )
      return {
        join: (email: string) => provide(joinWaitlist(email)),
        budget: (key: string) =>
          provide(consumeAuthRateLimit(key, { window: 60, max: 120 })),
      } satisfies WaitlistStoreService
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make)
}
