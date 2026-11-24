import { Effect, Schema } from "effect"
import { GetProjectWorkflowData, Onboarding, User } from "@flowmark/api"
import { t } from "./context"
import { onboardingQuery, sessionQuery } from "./execution"
import { UuidSchema } from "./schemas"
import { studioMutation } from "./studio-origin"
const OnboardingStep = Schema.toStandardSchemaV1(
  Schema.Struct({
    step: Schema.Literals(["project", "key", "install", "instrument", "run"]),
    projectId: Schema.optional(UuidSchema),
  }),
)

export const onboardingRouter = t.router({
  snapshot: t.procedure
    .input(Schema.toStandardSchemaV1(UuidSchema))
    .query(({ ctx, input }) =>
      sessionQuery(ctx.request, (userId) =>
        Effect.flatMap(GetProjectWorkflowData, (queries) =>
          queries.snapshot(User({ userId, projectId: input })),
        ),
      ),
    ),
  state: t.procedure.query(({ ctx }) =>
    onboardingQuery(ctx.request, (userId) =>
      Effect.flatMap(Onboarding, (onboarding) => onboarding.state(userId)),
    ),
  ),
  advance: studioMutation
    .input(OnboardingStep)
    .mutation(({ ctx, input }) =>
      onboardingQuery(ctx.request, (userId) =>
        Effect.flatMap(Onboarding, (onboarding) =>
          onboarding.advance(userId, input.step, input.projectId),
        ),
      ),
    ),
  complete: studioMutation
    .input(Schema.toStandardSchemaV1(Schema.Struct({ projectId: UuidSchema })))
    .mutation(({ ctx, input }) =>
      onboardingQuery(ctx.request, (userId) =>
        Effect.flatMap(Onboarding, (onboarding) =>
          onboarding.complete(userId, input.projectId),
        ),
      ),
    ),
})
