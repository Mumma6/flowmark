import { createHash } from "node:crypto"
import { Effect } from "effect"
import { consumeAuthRateLimit } from "../../auth/writes/consume-auth-rate-limit.js"
import { DatabaseOperation } from "../../database-operation.js"

export const consumePublicReadBudget = Effect.fn("consumePublicReadBudget")(
  (scope: string, maximum: number) =>
    consumeAuthRateLimit(
      createHash("sha256")
        .update(`flowmark:public-read:v1:${scope}`)
        .digest("hex"),
      { window: 60, max: maximum },
      DatabaseOperation.PublicReadAdmission,
    ),
)
