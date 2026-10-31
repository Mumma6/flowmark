import { PeerSelectionSchema } from "@flowmark/api"
import {
  BusinessTimestampSchema,
  BusinessInsightsQuerySchema,
  ResultSelectionSchema,
  RatioSelectionSchema,
  SearchFieldsSchema,
  BusinessKeySchema,
  BusinessValueSchema,
} from "@flowmark/api"
import { initTRPC, TRPCError } from "@trpc/server"
import { Effect, Exit, Match, Option, Schema } from "effect"
import {
  ManageResultDeclarations,
  ResultDeclarationSchema,
  ConfigurationError,
  GetProjectWorkflowData,
  InvalidInput,
  ManageProject,
  Onboarding,
  PersistenceError,
  logFailure,
  runApi,
  Unauthorized,
} from "@flowmark/api"
import { getAuth } from "../auth"
const t = initTRPC
  .context<{
    request: Request
  }>()
  .create()
// Keep the existing UUID-shape contract, including PostgreSQL UUID variants.
const UuidSchema = Schema.String.check(
  Schema.isPattern(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  ),
)
const Uuid = Schema.toStandardSchemaV1(UuidSchema)
const ProjectName = Schema.toStandardSchemaV1(
  Schema.Struct({
    name: Schema.Trim.pipe(Schema.check(Schema.isMinLength(1))),
  }),
)
const ProjectIdName = Schema.toStandardSchemaV1(
  Schema.Struct({
    projectId: UuidSchema,
    name: Schema.Trim.pipe(Schema.check(Schema.isMinLength(1))),
  }),
)
const ProjectKey = Schema.toStandardSchemaV1(
  Schema.Struct({
    projectId: UuidSchema,
    keyId: UuidSchema,
  }),
)
const BrowserKeyInput = Schema.toStandardSchemaV1(
  Schema.Struct({
    projectId: UuidSchema,
    name: Schema.Trim.pipe(Schema.check(Schema.isMinLength(1))),
    origins: Schema.Array(
      Schema.Trim.pipe(Schema.check(Schema.isMinLength(1))),
    ),
  }),
)
const IntelligenceInput = Schema.toStandardSchemaV1(
  Schema.Struct({
    workflow: Schema.optional(
      Schema.String.pipe(Schema.check(Schema.isMaxLength(200))),
    ),
    currentStartedAfter: Schema.String.pipe(
      Schema.check(Schema.isMinLength(1)),
      Schema.check(Schema.isMaxLength(40)),
    ),
    currentStartedBefore: Schema.String.pipe(
      Schema.check(Schema.isMinLength(1)),
      Schema.check(Schema.isMaxLength(40)),
    ),
    previousStartedAfter: Schema.String.pipe(
      Schema.check(Schema.isMinLength(1)),
      Schema.check(Schema.isMaxLength(40)),
    ),
    previousStartedBefore: Schema.String.pipe(
      Schema.check(Schema.isMinLength(1)),
      Schema.check(Schema.isMaxLength(40)),
    ),
  }),
)
const OnboardingStep = Schema.toStandardSchemaV1(
  Schema.Struct({
    step: Schema.Literals(["project", "key", "install", "instrument", "run"]),
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
  return Option.fromNullishOr(session?.user.id)
})

function requestedProjectId(request: Request) {
  const value = request.headers.get("x-flowmark-project-id")?.trim()
  return value && Schema.is(UuidSchema)(value) ? value : undefined
}

async function executeQuery<A>(
  request: Request,
  operation: Effect.Effect<
    A,
    Unauthorized | PersistenceError | ConfigurationError | InvalidInput,
    | GetProjectWorkflowData
    | ManageProject
    | Onboarding
    | ManageResultDeclarations
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
      Match.value(
        cause.reasons.length === 1 ? cause.reasons[0] : undefined,
      ).pipe(
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
    Unauthorized | PersistenceError | InvalidInput,
    GetProjectWorkflowData
  >,
  forKey: (
    header: string | null,
  ) => Effect.Effect<
    A,
    Unauthorized | PersistenceError | InvalidInput,
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
    ManageProject | ManageResultDeclarations
  >,
) {
  return executeQuery(
    request,
    sessionUserId(request).pipe(
      Effect.flatMap(
        Option.match({
          onNone: () => Effect.fail(new Unauthorized({ permission: "read" })),
          onSome: (userId) => forUser(userId),
        }),
      ),
    ),
  )
}

function onboardingQuery<A>(
  request: Request,
  operation: (
    userId: string,
  ) => Effect.Effect<
    A,
    Unauthorized | PersistenceError | InvalidInput,
    Onboarding
  >,
) {
  return executeQuery(
    request,
    sessionUserId(request).pipe(
      Effect.flatMap(
        Option.match({
          onNone: () => Effect.fail(new Unauthorized({ permission: "read" })),
          onSome: operation,
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
    businessInsights: t.procedure
      .input(Schema.toStandardSchemaV1(BusinessInsightsQuerySchema))
      .query(({ ctx, input }) =>
        readQuery(
          ctx.request,
          (userId, projectId) =>
            Effect.flatMap(GetProjectWorkflowData, (queries) =>
              queries.businessInsightsForUser(userId, input, projectId),
            ),
          (header) =>
            Effect.flatMap(GetProjectWorkflowData, (queries) =>
              queries.businessInsights(header, input),
            ),
        ),
      ),
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
    intelligence: t.procedure.input(IntelligenceInput).query(({ ctx, input }) =>
      readQuery(
        ctx.request,
        (userId, projectId) =>
          Effect.flatMap(GetProjectWorkflowData, (queries) =>
            queries.intelligenceForUser(userId, input, projectId),
          ),
        (header) =>
          Effect.flatMap(GetProjectWorkflowData, (queries) =>
            queries.intelligence(header, input),
          ),
      ),
    ),
    list: t.procedure.query(({ ctx }) =>
      sessionQuery(ctx.request, (userId) =>
        Effect.flatMap(ManageProject, (manage) => manage.list(userId)),
      ),
    ),
    create: t.procedure
      .input(ProjectName)
      .mutation(({ ctx, input }) =>
        sessionQuery(ctx.request, (userId) =>
          Effect.flatMap(ManageProject, (manage) =>
            manage.create(userId, input.name),
          ),
        ),
      ),
    rename: t.procedure
      .input(ProjectIdName)
      .mutation(({ ctx, input }) =>
        sessionQuery(ctx.request, (userId) =>
          Effect.flatMap(ManageProject, (manage) =>
            manage.rename(userId, input.projectId, input.name),
          ),
        ),
      ),
    keys: t.procedure
      .input(Uuid)
      .query(({ ctx, input }) =>
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
    revokeApiKey: t.procedure
      .input(ProjectKey)
      .mutation(({ ctx, input }) =>
        sessionQuery(ctx.request, (userId) =>
          Effect.flatMap(ManageProject, (manage) =>
            manage.revokeApiKey(userId, input.projectId, input.keyId),
          ),
        ),
      ),
    rotateWriteKey: t.procedure
      .input(ProjectKey)
      .mutation(({ ctx, input }) =>
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
  onboarding: t.router({
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
  }),
  resultDeclarations: t.router({
    searchFields: t.procedure
      .input(
        Schema.toStandardSchemaV1(
          Schema.Struct({
            projectId: UuidSchema,
            workflow: Schema.String.check(
              Schema.isMinLength(1),
              Schema.isMaxLength(200),
            ),
          }),
        ),
      )
      .query(({ ctx, input }) =>
        sessionQuery(ctx.request, (userId) =>
          Effect.flatMap(ManageResultDeclarations, (manage) =>
            manage.searchFields(userId, input.projectId, input.workflow),
          ),
        ),
      ),
    setSearchFields: t.procedure
      .input(
        Schema.toStandardSchemaV1(
          Schema.Struct({
            projectId: UuidSchema,
            workflow: Schema.String.check(
              Schema.isMinLength(1),
              Schema.isMaxLength(200),
            ),
            fields: SearchFieldsSchema,
          }),
        ),
      )
      .mutation(({ ctx, input }) =>
        sessionQuery(ctx.request, (userId) =>
          Effect.flatMap(ManageResultDeclarations, (manage) =>
            manage.setSearchFields(
              userId,
              input.projectId,
              input.workflow,
              input.fields,
            ),
          ),
        ),
      ),

    list: t.procedure
      .input(
        Schema.toStandardSchemaV1(
          Schema.Struct({
            projectId: UuidSchema,
            workflow: Schema.String.pipe(
              Schema.check(Schema.isMinLength(1)),
              Schema.check(Schema.isMaxLength(200)),
            ),
          }),
        ),
      )
      .query(({ ctx, input }) =>
        sessionQuery(ctx.request, (userId) =>
          Effect.flatMap(ManageResultDeclarations, (manage) =>
            manage.list(userId, input.projectId, input.workflow),
          ),
        ),
      ),
    create: t.procedure
      .input(
        Schema.toStandardSchemaV1(
          Schema.Struct({
            projectId: UuidSchema,
            workflow: Schema.String.pipe(
              Schema.check(Schema.isMinLength(1)),
              Schema.check(Schema.isMaxLength(200)),
            ),
            declaration: ResultDeclarationSchema,
          }),
        ),
      )
      .mutation(({ ctx, input }) =>
        sessionQuery(ctx.request, (userId) =>
          Effect.flatMap(ManageResultDeclarations, (manage) =>
            manage.create(
              userId,
              input.projectId,
              input.workflow,
              input.declaration,
            ),
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
    list: t.procedure
      .input(
        Schema.toStandardSchemaV1(
          Schema.Struct({
            workflow: Schema.optional(Schema.String),
            resultSelection: Schema.optional(ResultSelectionSchema),
            ratioSelection: Schema.optional(RatioSelectionSchema),
            outcome: Schema.optional(
              Schema.String.check(Schema.isMaxLength(64)),
            ),
            definitionRevision: Schema.optional(
              Schema.String.check(Schema.isMaxLength(64)),
            ),
            terminalOnly: Schema.optional(Schema.Boolean),
            startedBeforeExclusive: Schema.optional(BusinessTimestampSchema),
            businessKey: Schema.optional(BusinessKeySchema),
            businessValue: Schema.optional(BusinessValueSchema),
            status: Schema.optional(
              Schema.Literals(["Completed", "Failed", "Running"]),
            ),
            search: Schema.optional(
              Schema.String.pipe(Schema.check(Schema.isMaxLength(200))),
            ),
            externalId: Schema.optional(Schema.String),
            failCode: Schema.optional(Schema.String),
            environment: Schema.optional(Schema.String),
            release: Schema.optional(Schema.String),
            correlationId: Schema.optional(Schema.String),
            parentRunId: Schema.optional(Schema.String),
            namespace: Schema.optional(
              Schema.Literals(["browser", "application"]),
            ),
            startedAfter: Schema.optional(Schema.String),
            startedBefore: Schema.optional(Schema.String),
            cursor: Schema.optional(Schema.String),
            limit: Schema.optional(
              Schema.Number.pipe(
                Schema.check(Schema.isInt()),
                Schema.check(Schema.isBetween({ minimum: 1, maximum: 100 })),
              ),
            ),
          }).check(
            Schema.makeFilter(
              (input) =>
                (input.businessKey === undefined &&
                  input.businessValue === undefined) ||
                (input.businessKey !== undefined &&
                  input.businessValue !== undefined &&
                  Boolean(input.workflow)),
            ),
          ),
        ),
      )
      .query(({ ctx, input }) =>
        readQuery(
          ctx.request,
          (userId, projectId) =>
            Effect.flatMap(GetProjectWorkflowData, (queries) =>
              queries.listRunsForUser(userId, input, projectId),
            ),
          (header) =>
            Effect.flatMap(GetProjectWorkflowData, (queries) =>
              queries.listRuns(header, input),
            ),
        ),
      ),
    detail: t.procedure
      .input(Schema.toStandardSchemaV1(Schema.Struct({ id: UuidSchema })))
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
      .input(Schema.toStandardSchemaV1(Schema.Struct({ id: UuidSchema })))
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
      .input(
        Schema.toStandardSchemaV1(
          Schema.Struct({
            id: UuidSchema,
            selection: Schema.optional(PeerSelectionSchema),
          }),
        ),
      )
      .query(({ ctx, input }) =>
        readQuery(
          ctx.request,
          (userId, projectId) =>
            Effect.flatMap(GetProjectWorkflowData, (queries) =>
              queries.compareForUser(
                userId,
                input.id,
                projectId,
                input.selection,
              ),
            ),
          (header) =>
            Effect.flatMap(GetProjectWorkflowData, (queries) =>
              queries.compare(header, input.id, input.selection),
            ),
        ),
      ),
  }),
})

export type AppRouter = typeof appRouter
