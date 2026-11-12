import { ManageInvestigations } from "@flowmark/api"
import { Schema } from "effect"
import { t } from "./context"
import { UuidSchema } from "./schemas"
import { sessionQuery } from "./execution"
const scope = { projectId: UuidSchema }
export const investigationsRouter = t.router({
  save: t.procedure
    .input(
      Schema.toStandardSchemaV1(
        Schema.Struct({ ...scope, command: Schema.Unknown }),
      ),
    )
    .mutation(({ ctx, input }) =>
      sessionQuery(ctx.request, (userId) =>
        ManageInvestigations.use((manage) =>
          manage.save(userId, input.projectId, input.command),
        ),
      ),
    ),
  list: t.procedure
    .input(
      Schema.toStandardSchemaV1(
        Schema.Struct({ ...scope, query: Schema.Unknown }),
      ),
    )
    .query(({ ctx, input }) =>
      sessionQuery(ctx.request, (userId) =>
        ManageInvestigations.use((manage) =>
          manage.list(userId, input.projectId, input.query),
        ),
      ),
    ),
  get: t.procedure
    .input(
      Schema.toStandardSchemaV1(Schema.Struct({ ...scope, id: UuidSchema })),
    )
    .query(({ ctx, input }) =>
      sessionQuery(ctx.request, (userId) =>
        ManageInvestigations.use((manage) =>
          manage.get(userId, input.projectId, input.id),
        ),
      ),
    ),
  delete: t.procedure
    .input(
      Schema.toStandardSchemaV1(Schema.Struct({ ...scope, id: UuidSchema })),
    )
    .mutation(({ ctx, input }) =>
      sessionQuery(ctx.request, (userId) =>
        ManageInvestigations.use((manage) =>
          manage.delete(userId, input.projectId, input.id),
        ),
      ),
    ),
})
