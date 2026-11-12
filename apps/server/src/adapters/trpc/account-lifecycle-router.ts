import { Effect, Redacted, Schema } from "effect"
import {
  LifecycleReauthentication,
  ManageAccountLifecycle,
} from "@flowmark/api"
import { t } from "./context"
import { accountCleanupQuery, sessionQuery } from "./execution"
import { UuidSchema } from "./schemas"
import { lifecycleMutation } from "./lifecycle-origin"
import { lifecycleReauthentication } from "./lifecycle-reauthentication"

const strict = <S extends Schema.ConstraintDecoder<unknown>>(schema: S) =>
  Schema.toStandardSchemaV1(schema, {
    parseOptions: { onExcessProperty: "error" },
  })
const Capability = strict(
  Schema.Struct({
    operationId: UuidSchema,
    capability: Schema.String.check(Schema.isPattern(/^[A-Za-z0-9_-]{43}$/)),
  }),
)
export const accountLifecycleRouter = t.router({
  cancel: lifecycleMutation
    .input(strict(Schema.Struct({ operationId: UuidSchema })))
    .mutation(({ ctx, input }) =>
      sessionQuery(ctx.request, (userId) =>
        Effect.flatMap(ManageAccountLifecycle, (manage) =>
          manage.cancel(userId, input.operationId),
        ),
      ),
    ),
  preview: lifecycleMutation.mutation(({ ctx }) =>
    sessionQuery(ctx.request, (userId) =>
      Effect.flatMap(ManageAccountLifecycle, (manage) =>
        manage.preview(userId),
      ),
    ),
  ),
  confirm: lifecycleMutation
    .input(
      strict(
        Schema.Struct({
          operationId: UuidSchema,
          confirmation: Schema.String.check(Schema.isMaxLength(80)),
          password: Schema.String.check(
            Schema.isMinLength(1),
            Schema.isMaxLength(1024),
          ),
        }),
      ),
    )
    .mutation(({ ctx, input }) =>
      sessionQuery(ctx.request, (userId) =>
        Effect.flatMap(ManageAccountLifecycle, (manage) =>
          manage.confirm(
            userId,
            input.operationId,
            input.confirmation,
            Redacted.make(input.password),
          ),
        ).pipe(
          Effect.provideService(
            LifecycleReauthentication,
            lifecycleReauthentication(ctx.request),
          ),
        ),
      ),
    ),
  // Capabilities travel in POST bodies, never query strings or the ordinary auth cookie.
  status: lifecycleMutation.input(Capability).mutation(({ ctx, input }) =>
    accountCleanupQuery(
      ctx.request,
      Effect.flatMap(ManageAccountLifecycle, (manage) =>
        manage.status(input.operationId, Redacted.make(input.capability)),
      ),
    ),
  ),
  resume: lifecycleMutation.input(Capability).mutation(({ ctx, input }) =>
    accountCleanupQuery(
      ctx.request,
      Effect.flatMap(ManageAccountLifecycle, (manage) =>
        manage.resume(input.operationId, Redacted.make(input.capability)),
      ),
    ),
  ),
})
