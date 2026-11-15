import { Array, Context, Effect, Layer } from "effect"
import { InvalidInput, PersistenceError } from "../../../errors.js"
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
  Array.contains(steps, step)
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
    projectId?: string,
  ) => Effect.Effect<void, InvalidInput | PersistenceError>
  readonly complete: (
    userId: string,
    projectId: string,
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
      const selectedProject = Effect.fn("Onboarding.selectedProject")(
        function* (userId: string, requestedProjectId: string | undefined) {
          if (!requestedProjectId) {
            return yield* new InvalidInput({
              cause: "Select a project before continuing setup.",
            })
          }
          const projectId = yield* credentials.memberProject(
            userId,
            requestedProjectId,
            "owner",
          )
          if (!projectId) {
            return yield* new InvalidInput({
              cause: "Select a project you own before continuing setup.",
            })
          }
          return projectId
        },
      )
      const requireWriteKey = Effect.fn("Onboarding.requireWriteKey")(
        function* (userId: string, projectId: string) {
          const keys = yield* credentials.listApiKeys(userId, projectId)
          if (!Array.some(keys, (key) => key.permission === "write")) {
            return yield* new InvalidInput({
              cause:
                "Create a server write key for the selected project before continuing setup.",
            })
          }
        },
      )
      const state = Effect.fn("Onboarding.state")(function* (userId: string) {
        return (yield* credentials.onboardingState(userId)) ?? defaultState
      })
      const advance = Effect.fn("Onboarding.advance")(function* (
        userId: string,
        step: OnboardingStep,
        requestedProjectId?: string,
      ) {
        const nextStep = yield* validStep(step)
        if (nextStep !== "project") {
          const projectId = yield* selectedProject(userId, requestedProjectId)
          if (nextStep !== "key") {
            yield* requireWriteKey(userId, projectId)
          }
        }
        yield* credentials.updateOnboardingState(userId, nextStep, null)
      })
      const complete = Effect.fn("Onboarding.complete")(function* (
        userId: string,
        requestedProjectId: string,
      ) {
        const projectId = yield* selectedProject(userId, requestedProjectId)
        yield* requireWriteKey(userId, projectId)
        yield* credentials.updateOnboardingState(userId, "run", new Date())
      })
      return Onboarding.of({ state, advance, complete })
    }),
  )
}
