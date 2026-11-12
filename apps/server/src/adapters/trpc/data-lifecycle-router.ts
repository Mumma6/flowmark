import { TRPCError } from "@trpc/server"
import { serverOrigins } from "../../server-env"
import { Effect, Redacted, Schema } from "effect"
import {
  ErasureScopeSchema,
  LifecycleReauthentication,
  ManageDataLifecycle,
} from "@flowmark/api"
import { t } from "./context"
import { sessionQuery } from "./execution"
import { UuidSchema } from "./schemas"
import { lifecycleReauthentication } from "./lifecycle-reauthentication"

const inputSchema = <S extends Schema.ConstraintDecoder<unknown>>(schema: S) =>
  Schema.toStandardSchemaV1(schema, {
    parseOptions: { onExcessProperty: "error" },
  })

const Target = Schema.Struct({ projectId: UuidSchema })
const Operation = Schema.Struct({
  projectId: UuidSchema,
  operationId: UuidSchema,
})
const mutation = t.procedure.use(async ({ ctx, next }) => {
  const { dashboardOrigin } = await Effect.runPromise(serverOrigins())
  if (ctx.request.headers.get("origin") !== dashboardOrigin) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "A trusted Studio origin is required.",
    })
  }
  return next()
})
export const dataLifecycleRouter = t.router({
  preview: mutation
    .input(
      inputSchema(
        Schema.Struct({ projectId: UuidSchema, scope: ErasureScopeSchema }),
      ),
    )
    .mutation(({ ctx, input }) =>
      sessionQuery(ctx.request, (userId) =>
        Effect.flatMap(ManageDataLifecycle, (manage) =>
          manage.preview(userId, input.projectId, input.scope),
        ),
      ),
    ),
  status: t.procedure
    .input(inputSchema(Target))
    .query(({ ctx, input }) =>
      sessionQuery(ctx.request, (userId) =>
        Effect.flatMap(ManageDataLifecycle, (manage) =>
          manage.status(userId, input.projectId),
        ),
      ),
    ),
  confirm: mutation
    .input(
      inputSchema(
        Schema.Struct({
          ...Operation.fields,
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
        Effect.flatMap(ManageDataLifecycle, (manage) =>
          manage.confirm(
            userId,
            input.projectId,
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
  cancel: mutation
    .input(inputSchema(Operation))
    .mutation(({ ctx, input }) =>
      sessionQuery(ctx.request, (userId) =>
        Effect.flatMap(ManageDataLifecycle, (manage) =>
          manage.cancel(userId, input.projectId, input.operationId),
        ),
      ),
    ),
  resume: mutation
    .input(inputSchema(Operation))
    .mutation(({ ctx, input }) =>
      sessionQuery(ctx.request, (userId) =>
        Effect.flatMap(ManageDataLifecycle, (manage) =>
          manage.resume(userId, input.projectId, input.operationId),
        ),
      ),
    ),
})
