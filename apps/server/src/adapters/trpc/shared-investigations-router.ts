import { Schema } from "effect"
import {
  ManageSharedInvestigations,
  ShareInvestigationSchema,
  SharedInvestigationListSchema,
} from "@flowmark/api"
import { t } from "./context"
import { UuidSchema } from "./schemas"
import { readQuery, sessionQuery } from "./execution"
import { studioMutation } from "./studio-origin"
import { native } from "./native-saved-object"
const input = <S extends Schema.ConstraintDecoder<unknown>>(schema: S) =>
  Schema.toStandardSchemaV1(schema, {
    parseOptions: { onExcessProperty: "error" },
  })
const scope = { projectId: UuidSchema }
export const sharedInvestigationsRouter = t.router({
  create: studioMutation
    .input(
      input(Schema.Struct({ ...scope, command: ShareInvestigationSchema })),
    )
    .mutation(({ ctx, input }) =>
      sessionQuery(ctx.request, (userId) =>
        native(
          ctx.request,
          userId,
          ManageSharedInvestigations.use((service) =>
            service.create(
              { _tag: "User", userId, projectId: input.projectId },
              input.projectId,
              input.command,
            ),
          ),
        ),
      ),
    ),
  list: t.procedure
    .input(
      input(Schema.Struct({ ...scope, query: SharedInvestigationListSchema })),
    )
    .query(({ ctx, input }) =>
      readQuery(ctx.request, (reader) =>
        ManageSharedInvestigations.use((service) =>
          service.list(reader, input.projectId, input.query),
        ),
      ),
    ),
  get: t.procedure
    .input(input(Schema.Struct({ ...scope, id: UuidSchema })))
    .query(({ ctx, input }) =>
      readQuery(ctx.request, (reader) =>
        ManageSharedInvestigations.use((service) =>
          service.get(reader, input.projectId, input.id),
        ),
      ),
    ),
  revoke: studioMutation
    .input(input(Schema.Struct({ ...scope, id: UuidSchema })))
    .mutation(({ ctx, input }) =>
      sessionQuery(ctx.request, (userId) =>
        native(
          ctx.request,
          userId,
          ManageSharedInvestigations.use((service) =>
            service.revoke(
              { _tag: "User", userId, projectId: input.projectId },
              input.projectId,
              input.id,
            ),
          ),
        ),
      ),
    ),
})
