import {
  BusinessInsightsQuerySchema,
  PeriodReportQuerySchema,
} from "@flowmark/api"
import { Effect, Schema } from "effect"
import { GetProjectWorkflowData, ManageProject } from "@flowmark/api"
import { t } from "./context"
import { UuidSchema } from "./schemas"
import { readQuery, sessionQuery } from "./execution"
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

export const projectRouter = t.router({
  businessInsights: t.procedure
    .input(Schema.toStandardSchemaV1(BusinessInsightsQuerySchema))
    .query(({ ctx, input }) =>
      readQuery(ctx.request, (reader) =>
        Effect.flatMap(GetProjectWorkflowData, (queries) =>
          queries.businessInsights(reader, input),
        ),
      ),
    ),
  snapshot: t.procedure.query(({ ctx }) =>
    readQuery(ctx.request, (reader) =>
      Effect.flatMap(GetProjectWorkflowData, (queries) =>
        queries.snapshot(reader),
      ),
    ),
  ),
  intelligence: t.procedure
    .input(IntelligenceInput)
    .query(({ ctx, input }) =>
      readQuery(ctx.request, (reader) =>
        Effect.flatMap(GetProjectWorkflowData, (queries) =>
          queries.intelligence(reader, input),
        ),
      ),
    ),
  periodReport: t.procedure
    .input(Schema.toStandardSchemaV1(PeriodReportQuerySchema))
    .query(({ ctx, input }) =>
      readQuery(ctx.request, (reader) =>
        Effect.flatMap(GetProjectWorkflowData, (queries) =>
          queries.periodReport(reader, input),
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
  createReadKey: t.procedure
    .input(ProjectIdName)
    .mutation(({ ctx, input }) =>
      sessionQuery(ctx.request, (userId) =>
        Effect.flatMap(ManageProject, (manage) =>
          manage.createReadKey(userId, input.projectId, input.name),
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
})
