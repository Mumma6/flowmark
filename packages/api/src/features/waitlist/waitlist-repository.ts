import { Context, Effect } from "effect"
import type { PersistenceError } from "../../errors.js"

export class WaitlistRepository extends Context.Service<
  WaitlistRepository,
  {
    readonly join: (email: string) => Effect.Effect<void, PersistenceError>
    readonly budget: () => Effect.Effect<
      { readonly allowed: boolean; readonly retryAfter: number | null },
      PersistenceError
    >
  }
>()("@flowmark/api/WaitlistRepository") {}
