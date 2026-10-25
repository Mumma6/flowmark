import { initTRPC, TRPCError } from "@trpc/server"
import { Effect, Exit, Match, Option, Schema } from "effect"
import {
  ConfigurationError,
  GetProjectWorkflowData,
  PersistenceError,
  logFailure,
  runApi,
  type Unauthorized,
} from "@flowmark/api"
import { getAuth } from "../auth"

const t = initTRPC.context<{ request: Request }>().create()

const sessionUserId = Effect.fn("sessionUserId")(function* (request: Request) {
  if (!request.headers.get("cookie") || !process.env.DATABASE_URL) {
    return Option.none<string>()
  }
  const auth = yield* getAuth()
  const session = yield* Effect.tryPromise({
    try: () =>
      auth.api.getSession({
        headers: request.headers,
      }),
    catch: (cause) =>
      new PersistenceError({ operation: "auth-session", cause }),
  })
  return Option.fromNullable(session?.user.id)
})

async function executeQuery<A>(
  request: Request,
  operation: Effect.Effect<
    A,
    Unauthorized | PersistenceError | ConfigurationError,
    GetProjectWorkflowData
  >,
) {
  const result = await runApi(
    operation.pipe(
      Effect.catchTag("Unauthorized", () =>
        Effect.fail(
          new TRPCError({
            code: "UNAUTHORIZED",
            message: "Sign in required.",
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

function readQuery<A>(
  request: Request,
  forUser: (
    userId: string,
  ) => Effect.Effect<
    A,
    Unauthorized | PersistenceError,
    GetProjectWorkflowData
  >,
  forKey: (
    header: string | null,
  ) => Effect.Effect<
    A,
    Unauthorized | PersistenceError,
    GetProjectWorkflowData
  >,
) {
  return executeQuery(
    request,
    sessionUserId(request).pipe(
      Effect.flatMap(
        Option.match({
          onNone: () => forKey(request.headers.get("authorization")),
          onSome: (userId) => forUser(userId),
        }),
      ),
    ),
  )
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
      readQuery(
        ctx.request,
        (userId) =>
          Effect.flatMap(GetProjectWorkflowData, (queries) =>
            queries.snapshotForUser(userId),
          ),
        (header) =>
          Effect.flatMap(GetProjectWorkflowData, (queries) =>
            queries.snapshot(header),
          ),
      ),
    ),
  }),
  workflow: t.router({
    list: t.procedure.query(({ ctx }) =>
      readQuery(
        ctx.request,
        (userId) =>
          Effect.flatMap(GetProjectWorkflowData, (queries) =>
            queries.workflowsForUser(userId),
          ),
        (header) =>
          Effect.flatMap(GetProjectWorkflowData, (queries) =>
            queries.workflows(header),
          ),
      ),
    ),
  }),
  run: t.router({
    detail: t.procedure
      .input(Schema.standardSchemaV1(Schema.Struct({ id: Schema.UUID })))
      .query(({ ctx, input }) =>
        readQuery(
          ctx.request,
          (userId) =>
            Effect.flatMap(GetProjectWorkflowData, (queries) =>
              queries.timelineForUser(userId, input.id),
            ),
          (header) =>
            Effect.flatMap(GetProjectWorkflowData, (queries) =>
              queries.timeline(header, input.id),
            ),
        ),
      ),
    related: t.procedure
      .input(Schema.standardSchemaV1(Schema.Struct({ id: Schema.UUID })))
      .query(({ ctx, input }) =>
        readQuery(
          ctx.request,
          (userId) =>
            Effect.flatMap(GetProjectWorkflowData, (queries) =>
              queries.relatedForUser(userId, input.id),
            ),
          (header) =>
            Effect.flatMap(GetProjectWorkflowData, (queries) =>
              queries.related(header, input.id),
            ),
        ),
      ),
  }),
})

export type AppRouter = typeof appRouter
