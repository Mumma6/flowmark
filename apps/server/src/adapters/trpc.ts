import { initTRPC, TRPCError } from "@trpc/server"
import { Effect, Exit, Match, Schema } from "effect"
import {
  GetProjectWorkflowData,
  logFailure,
  runApi,
  type PersistenceError,
  type Unauthorized,
} from "@flowmark/api"

const t = initTRPC.context<{ request: Request }>().create()

async function executeQuery<A>(
  request: Request,
  operation: Effect.Effect<
    A,
    Unauthorized | PersistenceError,
    GetProjectWorkflowData
  >,
) {
  const result = await runApi(
    operation.pipe(
      Effect.catchTag("Unauthorized", () =>
        Effect.fail(
          new TRPCError({
            code: "UNAUTHORIZED",
            message: "Invalid dashboard read key.",
          }),
        ),
      ),
    ),
    request.signal,
  )
  const internalError = () => {
    logFailure(result)
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message:
        "Could not read workflow data. Check API database configuration.",
    })
  }
  return Exit.match(result, {
    onSuccess: (value) => value,
    onFailure: (cause) =>
      Match.value(cause).pipe(
        Match.tag("Fail", ({ error }) =>
          Match.value(error).pipe(
            Match.when(Match.instanceOf(TRPCError), (error) => {
              throw error
            }),
            Match.orElse(internalError),
          ),
        ),
        Match.orElse(internalError),
      ),
  })
}

export const appRouter = t.router({
  health: t.router({
    check: t.procedure.query(() => ({
      status: "ok" as const,
      service: "flowmark-api",
    })),
  }),
  project: t.router({
    snapshot: t.procedure.query(({ ctx }) =>
      executeQuery(
        ctx.request,
        Effect.flatMap(GetProjectWorkflowData, (queries) =>
          queries.snapshot(ctx.request.headers.get("authorization")),
        ),
      ),
    ),
  }),
  workflow: t.router({
    list: t.procedure.query(({ ctx }) =>
      executeQuery(
        ctx.request,
        Effect.flatMap(GetProjectWorkflowData, (queries) =>
          queries.workflows(ctx.request.headers.get("authorization")),
        ),
      ),
    ),
  }),
  run: t.router({
    detail: t.procedure
      .input(Schema.standardSchemaV1(Schema.Struct({ id: Schema.UUID })))
      .query(({ ctx, input }) =>
        executeQuery(
          ctx.request,
          Effect.flatMap(GetProjectWorkflowData, (queries) =>
            queries.timeline(
              ctx.request.headers.get("authorization"),
              input.id,
            ),
          ),
        ),
      ),
    related: t.procedure
      .input(Schema.standardSchemaV1(Schema.Struct({ id: Schema.UUID })))
      .query(({ ctx, input }) =>
        executeQuery(
          ctx.request,
          Effect.flatMap(GetProjectWorkflowData, (queries) =>
            queries.related(ctx.request.headers.get("authorization"), input.id),
          ),
        ),
      ),
  }),
})

export type AppRouter = typeof appRouter
