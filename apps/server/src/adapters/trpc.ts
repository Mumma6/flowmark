import { initTRPC, TRPCError } from "@trpc/server"
import { Effect, Exit, Match, Option, Schema } from "effect"
import {
  ConfigurationError,
  GetProjectWorkflowData,
  InvalidInput,
  ManageProject,
  PersistenceError,
  logFailure,
  runApi,
  Unauthorized,
} from "@flowmark/api"
import { getAuth } from "../auth"

const t = initTRPC.context<{ request: Request }>().create()

const Uuid = Schema.standardSchemaV1(Schema.UUID)
const ProjectName = Schema.standardSchemaV1(
  Schema.Struct({ name: Schema.Trim.pipe(Schema.minLength(1)) }),
)
const ProjectIdName = Schema.standardSchemaV1(
  Schema.Struct({
    projectId: Schema.UUID,
    name: Schema.Trim.pipe(Schema.minLength(1)),
  }),
)
const ProjectKey = Schema.standardSchemaV1(
  Schema.Struct({
    projectId: Schema.UUID,
    keyId: Schema.UUID,
  }),
)
const BrowserKeyInput = Schema.standardSchemaV1(
  Schema.Struct({
    projectId: Schema.UUID,
    name: Schema.Trim.pipe(Schema.minLength(1)),
    origins: Schema.Array(Schema.Trim.pipe(Schema.minLength(1))),
  }),
)

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

function requestedProjectId(request: Request) {
  const value = request.headers.get("x-flowmark-project-id")?.trim()
  return value && Schema.is(Schema.UUID)(value) ? value : undefined
}

async function executeQuery<A>(
  request: Request,
  operation: Effect.Effect<
    A,
    Unauthorized | PersistenceError | ConfigurationError | InvalidInput,
    GetProjectWorkflowData | ManageProject
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
      Effect.catchTag("InvalidInput", (error) =>
        Effect.fail(
          new TRPCError({
            code: "BAD_REQUEST",
            message:
              typeof error.cause === "string"
                ? error.cause
                : "Invalid request.",
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
    projectId?: string,
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
  const projectId = requestedProjectId(request)
  return executeQuery(
    request,
    sessionUserId(request).pipe(
      Effect.flatMap(
        Option.match({
          onNone: () => forKey(request.headers.get("authorization")),
          onSome: (userId) => forUser(userId, projectId),
        }),
      ),
    ),
  )
}

function sessionQuery<A>(
  request: Request,
  forUser: (
    userId: string,
  ) => Effect.Effect<
    A,
    Unauthorized | PersistenceError | InvalidInput,
    ManageProject
  >,
) {
  return executeQuery(
    request,
    sessionUserId(request).pipe(
      Effect.flatMap(
        Option.match({
          onNone: () =>
            Effect.fail(new Unauthorized({ permission: "read" })),
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
        (userId, projectId) =>
          Effect.flatMap(GetProjectWorkflowData, (queries) =>
            queries.snapshotForUser(userId, projectId),
          ),
        (header) =>
          Effect.flatMap(GetProjectWorkflowData, (queries) =>
            queries.snapshot(header),
          ),
      ),
    ),
    list: t.procedure.query(({ ctx }) =>
      sessionQuery(ctx.request, (userId) =>
        Effect.flatMap(ManageProject, (manage) => manage.list(userId)),
      ),
    ),
    create: t.procedure.input(ProjectName).mutation(({ ctx, input }) =>
      sessionQuery(ctx.request, (userId) =>
        Effect.flatMap(ManageProject, (manage) =>
          manage.create(userId, input.name),
        ),
      ),
    ),
    rename: t.procedure.input(ProjectIdName).mutation(({ ctx, input }) =>
      sessionQuery(ctx.request, (userId) =>
        Effect.flatMap(ManageProject, (manage) =>
          manage.rename(userId, input.projectId, input.name),
        ),
      ),
    ),
    keys: t.procedure.input(Uuid).query(({ ctx, input }) =>
      sessionQuery(ctx.request, (userId) =>
        Effect.flatMap(ManageProject, (manage) => manage.keys(userId, input)),
      ),
    ),
    createWriteKey: t.procedure
      .input(ProjectIdName)
      .mutation(({ ctx, input }) =>
        sessionQuery(ctx.request, (userId) =>
          Effect.flatMap(ManageProject, (manage) =>
            manage.createWriteKey(userId, input.projectId, input.name),
          ),
        ),
      ),
    revokeApiKey: t.procedure.input(ProjectKey).mutation(({ ctx, input }) =>
      sessionQuery(ctx.request, (userId) =>
        Effect.flatMap(ManageProject, (manage) =>
          manage.revokeApiKey(userId, input.projectId, input.keyId),
        ),
      ),
    ),
    rotateWriteKey: t.procedure.input(ProjectKey).mutation(({ ctx, input }) =>
      sessionQuery(ctx.request, (userId) =>
        Effect.flatMap(ManageProject, (manage) =>
          manage.rotateWriteKey(userId, input.projectId, input.keyId),
        ),
      ),
    ),
    createBrowserKey: t.procedure
      .input(BrowserKeyInput)
      .mutation(({ ctx, input }) =>
        sessionQuery(ctx.request, (userId) =>
          Effect.flatMap(ManageProject, (manage) =>
            manage.createBrowserKey(userId, input.projectId, {
              name: input.name,
              origins: input.origins,
            }),
          ),
        ),
      ),
    revokeBrowserKey: t.procedure
      .input(ProjectKey)
      .mutation(({ ctx, input }) =>
        sessionQuery(ctx.request, (userId) =>
          Effect.flatMap(ManageProject, (manage) =>
            manage.revokeBrowserKey(userId, input.projectId, input.keyId),
          ),
        ),
      ),
  }),
  workflow: t.router({
    list: t.procedure.query(({ ctx }) =>
      readQuery(
        ctx.request,
        (userId, projectId) =>
          Effect.flatMap(GetProjectWorkflowData, (queries) =>
            queries.workflowsForUser(userId, projectId),
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
          (userId, projectId) =>
            Effect.flatMap(GetProjectWorkflowData, (queries) =>
              queries.timelineForUser(userId, input.id, projectId),
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
          (userId, projectId) =>
            Effect.flatMap(GetProjectWorkflowData, (queries) =>
              queries.relatedForUser(userId, input.id, projectId),
            ),
          (header) =>
            Effect.flatMap(GetProjectWorkflowData, (queries) =>
              queries.related(header, input.id),
            ),
        ),
      ),
    compare: t.procedure
      .input(Schema.standardSchemaV1(Schema.Struct({ id: Schema.UUID })))
      .query(({ ctx, input }) =>
        readQuery(
          ctx.request,
          (userId, projectId) =>
            Effect.flatMap(GetProjectWorkflowData, (queries) =>
              queries.compareForUser(userId, input.id, projectId),
            ),
          (header) =>
            Effect.flatMap(GetProjectWorkflowData, (queries) =>
              queries.compare(header, input.id),
            ),
        ),
      ),
  }),
})

export type AppRouter = typeof appRouter
