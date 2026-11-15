import { Effect, Redacted, Schema } from "effect"
import { LifecycleReauthentication, ManageDataExports } from "@flowmark/api"
import { t } from "./context"
import { sessionQuery } from "./execution"
import { studioMutation } from "./studio-origin"
import { UuidSchema } from "./schemas"
import { lifecycleReauthentication } from "./lifecycle-reauthentication"
import { currentExportSession } from "../data-exports"

const strict = <S extends Schema.ConstraintDecoder<unknown>>(schema: S) =>
  Schema.toStandardSchemaV1(schema, {
    parseOptions: { onExcessProperty: "error" },
  })
export const dataExportsRouter = t.router({
  latest: t.procedure
    .input(strict(Schema.Struct({ projectId: Schema.NullOr(UuidSchema) })))
    .query(({ ctx, input }) =>
      sessionQuery(ctx.request, (userId) =>
        Effect.gen(function* () {
          const sessionId = yield* currentExportSession(ctx.request, userId)
          return yield* (yield* ManageDataExports).latest(
            userId,
            sessionId,
            input.projectId,
          )
        }),
      ),
    ),
  create: studioMutation
    .input(
      strict(
        Schema.Struct({
          projectId: Schema.NullOr(UuidSchema),
          password: Schema.String.check(
            Schema.isMinLength(1),
            Schema.isMaxLength(1024),
          ),
        }),
      ),
    )
    .mutation(({ ctx, input }) =>
      sessionQuery(ctx.request, (userId) =>
        Effect.flatMap(ManageDataExports, (manager) =>
          manager.create(
            userId,
            input.projectId,
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
  cancel: studioMutation
    .input(strict(Schema.Struct({ id: UuidSchema })))
    .mutation(({ ctx, input }) =>
      sessionQuery(ctx.request, (userId) =>
        Effect.gen(function* () {
          const sessionId = yield* currentExportSession(ctx.request, userId)
          return yield* (yield* ManageDataExports).cancel(
            userId,
            sessionId,
            input.id,
          )
        }),
      ),
    ),
})
