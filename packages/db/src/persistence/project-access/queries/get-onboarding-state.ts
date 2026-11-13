import { eq, sql } from "drizzle-orm"
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
        sharedAccess: sql<boolean>`EXISTS (SELECT 1 FROM project_members m JOIN projects p ON p.id = m.project_id WHERE m.user_id = ${userId} AND m.role = 'viewer' AND p.lifecycle_operation_id IS NULL AND NOT EXISTS (SELECT 1 FROM project_members o JOIN "user" owner ON owner.id = o.user_id WHERE o.project_id = p.id AND o.role = 'owner' AND owner.lifecycle_operation_id IS NOT NULL))`,
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
    sharedAccess: row.sharedAccess,
    completedAt: row.completedAt?.toISOString() ?? null,
  } satisfies OnboardingState
})
