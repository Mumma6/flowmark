import { ReferenceJourneyQuerySchema } from "@flowmark/api"
import { Effect, Schema } from "effect"
import { GetProjectWorkflowData } from "@flowmark/api"
import { t } from "./context"
import { readQuery } from "./execution"

export const workflowRouter = t.router({
  linkedComparison: t.procedure
    .input(Schema.toStandardSchemaV1(Schema.Unknown))
    .query(({ ctx, input }) =>
      readQuery(ctx.request, (reader) =>
        GetProjectWorkflowData.use((queries) =>
          queries.linkedComparison(reader, input),
        ),
      ),
    ),
  linkedEvidence: t.procedure
    .input(Schema.toStandardSchemaV1(Schema.Unknown))
    .query(({ ctx, input }) =>
      readQuery(ctx.request, (reader) =>
        GetProjectWorkflowData.use((queries) =>
          queries.linkedEvidence(reader, input),
        ),
      ),
    ),
  journey: t.procedure
    .input(
      Schema.toStandardSchemaV1(ReferenceJourneyQuerySchema, {
        parseOptions: { onExcessProperty: "error" },
      }),
    )
    .query(({ ctx, input }) =>
      readQuery(ctx.request, (reader) =>
        GetProjectWorkflowData.use((queries) =>
          queries.referenceJourney(reader, input),
        ),
      ),
    ),
  list: t.procedure.query(({ ctx }) =>
    readQuery(ctx.request, (reader) =>
      Effect.flatMap(GetProjectWorkflowData, (queries) =>
        queries.workflows(reader),
      ),
    ),
  ),
  discover: t.procedure
    .input(
      Schema.toStandardSchemaV1(
        Schema.Struct({
          cursor: Schema.optional(Schema.String),
          limit: Schema.optional(Schema.Number),
        }),
      ),
    )
    .query(({ ctx, input }) =>
      readQuery(ctx.request, (reader) =>
        Effect.flatMap(GetProjectWorkflowData, (queries) =>
          queries.discoverWorkflows(reader, input),
        ),
      ),
    ),
  meaning: t.procedure
    .input(
      Schema.toStandardSchemaV1(
        Schema.Struct({
          workflow: Schema.String.check(
            Schema.isMinLength(1),
            Schema.isMaxLength(200),
          ),
          revision: Schema.optional(Schema.String),
          cursor: Schema.optional(Schema.String),
          limit: Schema.optional(Schema.Number),
        }),
      ),
    )
    .query(({ ctx, input }) =>
      readQuery(ctx.request, (reader) =>
        Effect.flatMap(GetProjectWorkflowData, (queries) =>
          queries.discoverWorkflowMeaning(reader, input),
        ),
      ),
    ),
})
