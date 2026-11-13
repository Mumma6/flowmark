import { Schema } from "effect"
import {
  ManageEvidenceCaptures,
  CaptureRunSchema,
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
export const evidenceCapturesRouter = t.router({
  capabilities: t.procedure
    .input(input(Schema.Struct(scope)))
    .query(({ ctx, input }) =>
      readQuery(ctx.request, (reader) =>
        ManageEvidenceCaptures.use((service) =>
          service.capabilities(reader, input.projectId),
        ),
      ),
    ),
  create: studioMutation
    .input(input(Schema.Struct({ ...scope, command: CaptureRunSchema })))
    .mutation(({ ctx, input }) =>
      sessionQuery(ctx.request, (userId) =>
        native(
          ctx.request,
          userId,
          ManageEvidenceCaptures.use((service) =>
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
        ManageEvidenceCaptures.use((service) =>
          service.list(reader, input.projectId, input.query),
        ),
      ),
    ),
  get: t.procedure
    .input(input(Schema.Struct({ ...scope, id: UuidSchema })))
    .query(({ ctx, input }) =>
      readQuery(ctx.request, (reader) =>
        ManageEvidenceCaptures.use((service) =>
          service.get(reader, input.projectId, input.id),
        ),
      ),
    ),
  delete: studioMutation
    .input(input(Schema.Struct({ ...scope, id: UuidSchema })))
    .mutation(({ ctx, input }) =>
      sessionQuery(ctx.request, (userId) =>
        native(
          ctx.request,
          userId,
          ManageEvidenceCaptures.use((service) =>
            service.delete(
              { _tag: "User", userId, projectId: input.projectId },
              input.projectId,
              input.id,
            ),
          ),
        ),
      ),
    ),
})
