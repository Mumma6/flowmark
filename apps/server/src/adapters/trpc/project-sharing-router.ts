import { Effect, Schema } from "effect"
import {
  ManageProjectSharing,
  ProjectInvitationDelivery,
  ProjectSharingIdentity,
  InviteProjectSchema,
  ReviewInvitationSchema,
} from "@flowmark/api"
import { t } from "./context"
import { studioMutation } from "./studio-origin"
import { sessionQuery } from "./execution"
import { UuidSchema } from "./schemas"
import {
  sharingIdentity,
  sharingNotifications,
} from "./project-sharing-boundary"
type SessionOperation<A> = ReturnType<Parameters<typeof sessionQuery<A>>[1]>
function sharingSessionQuery<A>(
  request: Request,
  use: (
    userId: string,
  ) => Effect.Effect<
    A,
    Effect.Error<SessionOperation<A>>,
    Effect.Services<SessionOperation<A>> | ProjectSharingIdentity
  >,
) {
  return sessionQuery(request, (userId) =>
    use(userId).pipe(
      Effect.provideService(ProjectSharingIdentity, sharingIdentity(request)),
    ),
  )
}
const input = <S extends Schema.ConstraintDecoder<unknown>>(schema: S) =>
  Schema.toStandardSchemaV1(schema, {
    parseOptions: { onExcessProperty: "error" },
  })
export const projectSharingRouter = t.router({
  list: t.procedure
    .input(input(Schema.Struct({ projectId: UuidSchema })))
    .query(({ ctx, input }) =>
      sharingSessionQuery(ctx.request, (userId) =>
        Effect.flatMap(ManageProjectSharing, (sharing) =>
          sharing.list(userId, input.projectId),
        ),
      ),
    ),
  invite: studioMutation
    .input(input(InviteProjectSchema))
    .mutation(({ ctx, input }) =>
      sharingSessionQuery(ctx.request, (userId) =>
        Effect.flatMap(ManageProjectSharing, (sharing) =>
          sharing.invite(userId, input),
        ).pipe(
          Effect.provideService(
            ProjectSharingIdentity,
            sharingIdentity(ctx.request),
          ),
          Effect.provideService(
            ProjectInvitationDelivery,
            sharingNotifications(),
          ),
        ),
      ),
    ),
  review: studioMutation
    .input(input(ReviewInvitationSchema))
    .mutation(({ ctx, input }) =>
      sharingSessionQuery(ctx.request, (userId) =>
        Effect.flatMap(ManageProjectSharing, (sharing) =>
          sharing.review(userId, input),
        ).pipe(
          Effect.provideService(
            ProjectSharingIdentity,
            sharingIdentity(ctx.request),
          ),
        ),
      ),
    ),
  revoke: studioMutation
    .input(input(Schema.Struct({ projectId: UuidSchema, id: UuidSchema })))
    .mutation(({ ctx, input }) =>
      sharingSessionQuery(ctx.request, (userId) =>
        Effect.flatMap(ManageProjectSharing, (sharing) =>
          sharing.revoke(userId, input.projectId, input.id),
        ),
      ),
    ),
  remove: studioMutation
    .input(
      input(
        Schema.Struct({
          projectId: UuidSchema,
          userId: Schema.String.check(
            Schema.isMinLength(1),
            Schema.isMaxLength(256),
          ),
        }),
      ),
    )
    .mutation(({ ctx, input }) =>
      sharingSessionQuery(ctx.request, (userId) =>
        Effect.flatMap(ManageProjectSharing, (sharing) =>
          sharing.remove(userId, input.projectId, input.userId),
        ),
      ),
    ),
})
