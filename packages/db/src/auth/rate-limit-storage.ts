import { createHmac } from "node:crypto"
import { Effect } from "effect"
import type { FlowmarkDatabase } from "../client.js"
import { Database } from "../persistence/database.js"
import {
  consumeAuthRateLimit,
  type AuthLimitRule,
} from "../persistence/auth/writes/consume-auth-rate-limit.js"

export const authLimitKey = (secret: string, key: string) =>
  createHmac("sha256", secret)
    .update(`flowmark-auth-limit-v1:${key}`)
    .digest("hex")

/** Better Auth's supported atomic customStorage boundary, shared with account limits. */
export function createAuthRateLimitStorage(
  db: FlowmarkDatabase,
  secret: string,
) {
  return {
    consume: (key: string, rule: AuthLimitRule) =>
      Effect.runPromise(
        Effect.gen(function* () {
          // Fixed key first: bounds new counter allocation even with rotating IPs/emails.
          const admitted = yield* consumeAuthRateLimit(
            authLimitKey(secret, "admission"),
            { window: 60, max: 2000 },
          )
          if (!admitted.allowed) {
            return admitted
          }
          return yield* consumeAuthRateLimit(authLimitKey(secret, key), rule)
        }).pipe(Effect.provideService(Database, db)),
      ),
  }
}
