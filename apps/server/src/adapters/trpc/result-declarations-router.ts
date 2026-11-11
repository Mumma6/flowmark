import { SearchFieldsSchema } from "@flowmark/api"
import { Effect, Schema } from "effect"
import {
  ManageResultDeclarations,
  ResultDeclarationSchema,
} from "@flowmark/api"
import { t } from "./context"
import { UuidSchema } from "./schemas"
import { sessionQuery } from "./execution"

export const resultDeclarationsRouter = t.router({
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
})
