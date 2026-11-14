import { createHash } from "node:crypto"
import { Effect, Layer } from "effect"
import { WaitlistStore } from "@flowmark/db/persistence"
import { persist } from "../../adapters/persistence-error.js"
import { WaitlistRepository } from "./waitlist-repository.js"

export const WaitlistRepositoryLive = Layer.effect(
  WaitlistRepository,
  Effect.gen(function* () {
    const store = yield* WaitlistStore
    // One environment-wide budget; no untrusted forwarded IP or personal data in limiter keys.
    const key = createHash("sha256")
      .update("flowmark:waitlist:submissions:v1")
      .digest("hex")
    return WaitlistRepository.of({
      join: (email) => persist(store.join(email)),
      budget: () => persist(store.budget(key)),
    })
  }),
)
