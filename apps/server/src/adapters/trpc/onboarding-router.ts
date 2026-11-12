import { Effect, Schema } from "effect"
import { Onboarding } from "@flowmark/api"
import { t } from "./context"
import { onboardingQuery } from "./execution"
const OnboardingStep = Schema.toStandardSchemaV1(
  Schema.Struct({
    step: Schema.Literals(["project", "key", "install", "instrument", "run"]),
  }),
)

export const onboardingRouter = t.router({
  state: t.procedure.query(({ ctx }) =>
    onboardingQuery(ctx.request, (userId) =>
      Effect.flatMap(Onboarding, (onboarding) => onboarding.state(userId)),
    ),
  ),
  advance: t.procedure
    .input(OnboardingStep)
    .mutation(({ ctx, input }) =>
      onboardingQuery(ctx.request, (userId) =>
        Effect.flatMap(Onboarding, (onboarding) =>
          onboarding.advance(userId, input.step),
        ),
      ),
    ),
  complete: t.procedure.mutation(({ ctx }) =>
    onboardingQuery(ctx.request, (userId) =>
      Effect.flatMap(Onboarding, (onboarding) => onboarding.complete(userId)),
    ),
  ),
})
