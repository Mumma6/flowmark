import { createHash } from "node:crypto"
import { Effect } from "effect"
import { consumeAuthRateLimit } from "../../auth/writes/consume-auth-rate-limit.js"
import { DatabaseOperation } from "../../database-operation.js"

/** Separate namespaces/counters; only atomic mechanics are shared with login. */
export const consumeMcpBudget = Effect.fn("consumeMcpBudget")(function* (
  scope: string,
  maximum: number,
) {
  const key = createHash("sha256")
    .update(`flowmark:mcp:v1:${scope}`)
    .digest("hex")
  return yield* consumeAuthRateLimit(
    key,
    { window: 60, max: maximum },
    DatabaseOperation.McpAdmission,
  )
})
