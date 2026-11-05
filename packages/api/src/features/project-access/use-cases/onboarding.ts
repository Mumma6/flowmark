import { Context, Effect, Layer } from "effect"
import { InvalidInput, PersistenceError } from "../../../errors.js"
import { WorkflowRepository } from "../../workflows/ports/workflow-repository.js"
import {
  ProjectCredentials,
  type OnboardingState,
  type OnboardingStep,
} from "../ports/project-credentials.js"

const steps: ReadonlyArray<OnboardingStep> = [
  "project",
  "key",
  "install",
  "instrument",
  "run",
]

const defaultState: OnboardingState = {
  step: "project",
  completedAt: null,
}

const validStep = (step: OnboardingStep) =>
  steps.includes(step)
    ? Effect.succeed(step)
    : Effect.fail(
        new InvalidInput({
          cause: "Unknown onboarding step.",
        }),
      )

export interface OnboardingService {
  readonly state: (
    userId: string,
  ) => Effect.Effect<OnboardingState, PersistenceError>
  readonly advance: (
    userId: string,
    step: OnboardingStep,
  ) => Effect.Effect<void, InvalidInput | PersistenceError>
  readonly complete: (
    userId: string,
  ) => Effect.Effect<void, InvalidInput | PersistenceError>
}
export class Onboarding extends Context.Service<
  Onboarding,
  OnboardingService
>()("@flowmark/api/Onboarding") {
  static readonly layer = Layer.effect(
    Onboarding,
    Effect.gen(function* () {
      const credentials = yield* ProjectCredentials
      const repository = yield* WorkflowRepository
      const state = Effect.fn("Onboarding.state")(function* (userId: string) {
        return (yield* credentials.onboardingState(userId)) ?? defaultState
      })
      const advance = Effect.fn("Onboarding.advance")(function* (
        userId: string,
        step: OnboardingStep,
      ) {
        const nextStep = yield* validStep(step)
        if (nextStep !== "project") {
          const projectId = yield* credentials.projectForUser(userId)
          if (!projectId) {
            return yield* new InvalidInput({
              cause: "Create a project before continuing onboarding.",
            })
          }
        }
        yield* credentials.updateOnboardingState(userId, nextStep, null)
      })
      const complete = Effect.fn("Onboarding.complete")(function* (
        userId: string,
      ) {
        const projectId = yield* credentials.projectForUser(userId)
        if (!projectId) {
          return yield* new InvalidInput({
            cause: "Create a project before completing onboarding.",
          })
        }
        const keys = yield* Effect.all([
          credentials.listApiKeys(projectId),
          credentials.listBrowserKeys(projectId),
        ])
        if (keys[0].length === 0) {
          return yield* new InvalidInput({
            cause: "Create an ingestion key before completing onboarding.",
          })
        }
        const runs = yield* repository.listRuns(projectId, { limit: 1 })
        if (runs.runs.length === 0 && runs.total === 0) {
          return yield* new InvalidInput({
            cause:
              "Recorded evidence is required before completing setup. Run your application and return when a run appears for this project.",
          })
        }
        yield* credentials.updateOnboardingState(userId, "run", new Date())
      })
      return Onboarding.of({ state, advance, complete })
    }),
  )
}
