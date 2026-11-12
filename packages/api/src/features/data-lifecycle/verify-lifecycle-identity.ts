import { Effect, type Redacted } from "effect"
import { Unauthorized } from "../../errors.js"
import { LifecycleReauthentication } from "./ports/data-lifecycle.js"

/** Fresh provider proof is consumed within its exact confirmation request. */
export const verifyLifecycleIdentity = Effect.fn("verifyLifecycleIdentity")(
  function* (userId: string, password: Redacted.Redacted<string>) {
    const identity = yield* (yield* LifecycleReauthentication).verify(password)
    const now = Date.now()
    if (
      identity.userId !== userId ||
      !identity.sessionId ||
      !Number.isFinite(identity.verifiedAt) ||
      identity.verifiedAt > now ||
      now - identity.verifiedAt > 300_000
    ) {
      return yield* new Unauthorized({ permission: "write" })
    }
  },
)
