import { eq } from "drizzle-orm"
import { Effect } from "effect"
import { user } from "../../../schema/index.js"
import { Database } from "../../database.js"
import { DatabaseOperation } from "../../database-operation.js"
import { runQuery } from "../../run-query.js"
import type { OnboardingState, OnboardingStep } from "../types.js"

const steps: ReadonlyArray<OnboardingStep> = [
  "project",
  "key",
  "install",
  "instrument",
  "run",
]

const decodeStep = (value: string): OnboardingStep =>
  steps.includes(value as OnboardingStep)
    ? (value as OnboardingStep)
    : "project"

export const getOnboardingState = Effect.fn("getOnboardingState")(function* (
  userId: string,
) {
  const db = yield* Database
  const [row] = yield* runQuery(DatabaseOperation.ReadOnboardingState, () =>
    db
      .select({
        step: user.onboardingStep,
        completedAt: user.onboardingCompletedAt,
      })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1),
  )
  if (!row) {
    return undefined
  }
  return {
    step: decodeStep(row.step),
    completedAt: row.completedAt?.toISOString() ?? null,
  } satisfies OnboardingState
})
