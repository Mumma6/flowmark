import { readAuthSecret } from "@flowmark/auth"
import {
  ExpectationIdentifierSchema,
  ExpectationStateSchema,
} from "@flowmark/api"
import { PeerSelectionSchema } from "@flowmark/api"
import {
  BusinessTimestampSchema,
  ResultSelectionSchema,
  RatioSelectionSchema,
  BusinessKeySchema,
  BusinessValueSchema,
} from "@flowmark/api"
import { Effect, Schema } from "effect"
import {
  ConfigurationError,
  GetProjectWorkflowData,
  checkRuntimeQuestion,
  RuntimeQuestionCheckSchema,
  RUNTIME_CITATION_MAX_LENGTH,
  resolveRuntimeCitation,
} from "@flowmark/api"
import { t } from "./context"
import { UuidSchema } from "./schemas"
import { readQuery, sessionQuery } from "./execution"

export const runRouter = t.router({
  questionReadiness: t.procedure
    .input(
      Schema.toStandardSchemaV1(RuntimeQuestionCheckSchema, {
        parseOptions: { onExcessProperty: "error" },
      }),
    )
    .mutation(({ ctx, input }) =>
      readQuery(ctx.request, (reader) => checkRuntimeQuestion(reader, input)),
    ),
  citation: t.procedure
    .input(
      Schema.toStandardSchemaV1(
        Schema.Struct({
          handle: Schema.String.check(
            Schema.isMaxLength(RUNTIME_CITATION_MAX_LENGTH),
          ),
        }),
      ),
    )
    .mutation(({ ctx, input }) =>
      sessionQuery(ctx.request, (userId) =>
        readAuthSecret().pipe(
          Effect.mapError((error) => new ConfigurationError({ cause: error })),
          Effect.flatMap((secret) =>
            resolveRuntimeCitation(userId, secret, input.handle),
          ),
        ),
      ),
    ),
  list: t.procedure
    .input(
      Schema.toStandardSchemaV1(
        Schema.Struct({
          workflow: Schema.optional(Schema.String),
          expectationState: Schema.optional(ExpectationStateSchema),
          resultSelection: Schema.optional(ResultSelectionSchema),
          ratioSelection: Schema.optional(RatioSelectionSchema),
          outcome: Schema.optional(Schema.String.check(Schema.isMaxLength(64))),
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
      readQuery(ctx.request, (reader) =>
        Effect.flatMap(GetProjectWorkflowData, (queries) =>
          queries.listRuns(reader, input),
        ),
      ),
    ),
  detail: t.procedure
    .input(Schema.toStandardSchemaV1(Schema.Struct({ id: UuidSchema })))
    .query(({ ctx, input }) =>
      readQuery(ctx.request, (reader) =>
        Effect.flatMap(GetProjectWorkflowData, (queries) =>
          queries.timeline(reader, input.id),
        ),
      ),
    ),
  investigationSummary: t.procedure
    .input(Schema.toStandardSchemaV1(Schema.Struct({ id: UuidSchema })))
    .query(({ ctx, input }) =>
      readQuery(ctx.request, (reader) =>
        Effect.flatMap(GetProjectWorkflowData, (queries) =>
          queries.runInvestigationSummary(reader, input.id),
        ),
      ),
    ),
  eventPage: t.procedure
    .input(
      Schema.toStandardSchemaV1(
        Schema.Struct({
          runId: UuidSchema,
          cursor: Schema.optional(Schema.String),
          limit: Schema.optional(
            Schema.Number.pipe(
              Schema.check(Schema.isInt()),
              Schema.check(Schema.isBetween({ minimum: 1, maximum: 100 })),
            ),
          ),
        }),
      ),
    )
    .query(({ ctx, input }) =>
      readQuery(ctx.request, (reader) =>
        Effect.flatMap(GetProjectWorkflowData, (queries) =>
          queries.runEventPage(reader, input),
        ),
      ),
    ),
  relatedPage: t.procedure
    .input(
      Schema.toStandardSchemaV1(
        Schema.Struct({
          runId: UuidSchema,
          cursor: Schema.optional(Schema.String),
          limit: Schema.optional(
            Schema.Number.pipe(
              Schema.check(Schema.isInt()),
              Schema.check(Schema.isBetween({ minimum: 1, maximum: 100 })),
            ),
          ),
        }),
      ),
    )
    .query(({ ctx, input }) =>
      readQuery(ctx.request, (reader) =>
        Effect.flatMap(GetProjectWorkflowData, (queries) =>
          queries.relatedRunsPage(reader, input),
        ),
      ),
    ),
  expectationsPage: t.procedure
    .input(
      Schema.toStandardSchemaV1(
        Schema.Struct({
          runId: UuidSchema,
          expectationId: Schema.optional(ExpectationIdentifierSchema),
          cursor: Schema.optional(Schema.String),
          limit: Schema.optional(
            Schema.Number.pipe(
              Schema.check(Schema.isInt()),
              Schema.check(Schema.isBetween({ minimum: 1, maximum: 100 })),
            ),
          ),
        }),
      ),
    )
    .query(({ ctx, input }) =>
      readQuery(ctx.request, (reader) =>
        Effect.flatMap(GetProjectWorkflowData, (queries) =>
          queries.expectationsPage(reader, input),
        ),
      ),
    ),
  operationsPage: t.procedure
    .input(
      Schema.toStandardSchemaV1(
        Schema.Struct({
          runId: UuidSchema,
          cursor: Schema.optional(Schema.String),
          limit: Schema.optional(
            Schema.Number.pipe(
              Schema.check(Schema.isInt()),
              Schema.check(Schema.isBetween({ minimum: 1, maximum: 100 })),
            ),
          ),
        }),
      ),
    )
    .query(({ ctx, input }) =>
      readQuery(ctx.request, (reader) =>
        Effect.flatMap(GetProjectWorkflowData, (queries) =>
          queries.operationsPage(reader, input),
        ),
      ),
    ),
  expectations: t.procedure
    .input(Schema.toStandardSchemaV1(Schema.Struct({ id: UuidSchema })))
    .query(({ ctx, input }) =>
      readQuery(ctx.request, (reader) =>
        Effect.flatMap(GetProjectWorkflowData, (queries) =>
          queries.expectations(reader, input.id),
        ),
      ),
    ),
  related: t.procedure
    .input(Schema.toStandardSchemaV1(Schema.Struct({ id: UuidSchema })))
    .query(({ ctx, input }) =>
      readQuery(ctx.request, (reader) =>
        Effect.flatMap(GetProjectWorkflowData, (queries) =>
          queries.related(reader, input.id),
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
      readQuery(ctx.request, (reader) =>
        Effect.flatMap(GetProjectWorkflowData, (queries) =>
          queries.compare(reader, input.id, input.selection),
        ),
      ),
    ),
})
