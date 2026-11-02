import { createHash } from "node:crypto"
import { Effect } from "effect"
import { consumeAuthRateLimit } from "../../auth/writes/consume-auth-rate-limit.js"

/** Authenticated actor IDs have two fixed bucket kinds; no request-defined keys. */
export const consumeCreationQuota = Effect.fn("consumeCreationQuota")(
  function* (userId: string, kind: "project" | "key") {
    const key = createHash("sha256")
      .update(JSON.stringify(["flowmark-creation-v1", kind, userId]))
      .digest("hex")
    return yield* consumeAuthRateLimit(key, {
      window: 900,
      max: kind === "project" ? 10 : 30,
    })
  },
)
