import { eq } from "drizzle-orm"
import { Effect } from "effect"
import { user } from "../../../schema/index.js"
import { Database } from "../../database.js"
import { DatabaseOperation } from "../../database-operation.js"
import { runQuery } from "../../run-query.js"
import type { OnboardingStep } from "../types.js"

export const updateOnboardingState = Effect.fn("updateOnboardingState")(
  function* (userId: string, step: OnboardingStep, completedAt: Date | null) {
    const db = yield* Database
    yield* runQuery(DatabaseOperation.UpdateOnboardingState, () =>
      db
        .update(user)
        .set({
          onboardingStep: step,
          onboardingCompletedAt: completedAt,
        })
        .where(eq(user.id, userId)),
    )
  },
)
