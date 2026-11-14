import { Context, Effect, Layer } from "effect"
import { sql } from "drizzle-orm"
import { Database, DatabaseCancellation, provideDatabase } from "../database.js"
import {
  createProjectInvitation,
  markInvitationDelivery,
} from "./writes/create-invitation.js"
import { reviewProjectInvitation } from "./writes/review-invitation.js"
import {
  removeProjectViewer,
  revokeProjectInvitation,
} from "./writes/manage-membership.js"
import { listProjectSharing } from "./queries/list-project-sharing.js"
import { consumeAuthRateLimit } from "../auth/writes/consume-auth-rate-limit.js"
import { sharingQuery } from "./with-sharing-project.js"

export class ProjectSharingStore extends Context.Service<ProjectSharingStore>()(
  "@flowmark/db/ProjectSharingStore",
  {
    make: Effect.gen(function* () {
      const db = yield* Database
      const provide = provideDatabase(db, yield* DatabaseCancellation)
      return {
        list: (userId: string, projectId: string) =>
          provide(listProjectSharing(userId, projectId)),
        invite: (
          userId: string,
          projectId: string,
          email: string,
          hash: string,
          role: "viewer" | "business" = "viewer",
        ) =>
          provide(
            createProjectInvitation(userId, projectId, email, hash, role),
          ),
        delivery: (id: string, hash: string, value: "submitted" | "failed") =>
          provide(markInvitationDelivery(id, hash, value)),
        review: (
          userId: string,
          id: string,
          hash: string,
          action: "review" | "accept" | "decline",
        ) => provide(reviewProjectInvitation(userId, id, hash, action)),
        remove: (userId: string, projectId: string, targetId: string) =>
          provide(removeProjectViewer(userId, projectId, targetId)),
        revoke: (userId: string, projectId: string, id: string) =>
          provide(revokeProjectInvitation(userId, projectId, id)),
        budget: (hash: string, window: number, max: number) =>
          provide(consumeAuthRateLimit(hash, { window, max })),
        prune: () =>
          sharingQuery(() =>
            db.execute(
              sql`DELETE FROM project_invitations WHERE id IN (SELECT id FROM project_invitations WHERE updated_at < clock_timestamp() - interval '7 days' AND (state <> 'pending' OR expires_at <= clock_timestamp()) ORDER BY updated_at LIMIT 100 FOR UPDATE SKIP LOCKED)`,
            ),
          ),
      }
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make)
}
