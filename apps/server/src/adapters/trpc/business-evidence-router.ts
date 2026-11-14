import { Effect, Schema } from "effect"
import {
  BusinessEvidenceQuerySchema,
  BusinessPublicationSchema,
} from "@flowmark/api"
import { GetBusinessEvidence, Unauthorized } from "@flowmark/api"
import { t } from "./context"
import { readQuery, sessionQuery } from "./execution"
import { studioMutation } from "./studio-origin"
import { sharingIdentity } from "./project-sharing-boundary"
import { UuidSchema } from "./schemas"
const input = <S extends Schema.ConstraintDecoder<unknown>>(schema: S) =>
  Schema.toStandardSchemaV1(schema, {
    parseOptions: { onExcessProperty: "error" },
  })
const native = <A, E, R>(
  request: Request,
  userId: string,
  use: Effect.Effect<A, E, R>,
) =>
  Effect.gen(function* () {
    const actor = yield* sharingIdentity(request).current
    if (actor.userId !== userId) {
      return yield* new Unauthorized({ permission: "write" })
    }
    return yield* use
  })
export const businessEvidenceRouter = t.router({
  capabilities: t.procedure.query(({ ctx }) =>
    readQuery(ctx.request, (reader) =>
      Effect.flatMap(GetBusinessEvidence, (service) =>
        service.capabilities(reader),
      ),
    ),
  ),
  read: t.procedure
    .input(input(BusinessEvidenceQuerySchema))
    .query(({ ctx, input }) =>
      readQuery(ctx.request, (reader) =>
        Effect.flatMap(GetBusinessEvidence, (service) =>
          service.read(reader, input),
        ),
      ),
    ),
  configuration: t.procedure
    .input(input(Schema.Struct({ projectId: UuidSchema })))
    .query(({ ctx, input }) =>
      sessionQuery(ctx.request, (userId) =>
        native(
          ctx.request,
          userId,
          Effect.flatMap(GetBusinessEvidence, (service) =>
            service.configuration(userId, input.projectId),
          ),
        ),
      ),
    ),
  replace: studioMutation
    .input(
      input(
        Schema.Struct({
          projectId: UuidSchema,
          expectedRevision: Schema.Number.check(
            Schema.isInt(),
            Schema.isGreaterThanOrEqualTo(0),
          ),
          publication: BusinessPublicationSchema,
        }),
      ),
    )
    .mutation(({ ctx, input }) =>
      sessionQuery(ctx.request, (userId) =>
        native(
          ctx.request,
          userId,
          Effect.flatMap(GetBusinessEvidence, (service) =>
            service.replace(userId, input.projectId, {
              expectedRevision: input.expectedRevision,
              publication: input.publication,
            }),
          ),
        ),
      ),
    ),
})
