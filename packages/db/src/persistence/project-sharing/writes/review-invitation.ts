import { and, eq } from "drizzle-orm"
import { Effect } from "effect"
import {
  projectInvitations,
  projectMembers,
  projects,
  user,
} from "../../../schema/index.js"
import { Database } from "../../database.js"
import { SharingRejected } from "../types.js"
import {
  sharingOwner,
  sharingQuery,
  withSharingProject,
} from "../with-sharing-project.js"

export const reviewProjectInvitation = Effect.fn("reviewProjectInvitation")(
  function* (
    userId: string,
    id: string,
    tokenHash: string,
    action: "review" | "accept" | "decline",
  ) {
    const db = yield* Database
    const [located] = yield* sharingQuery(() =>
      db
        .select({ projectId: projectInvitations.projectId })
        .from(projectInvitations)
        .where(eq(projectInvitations.id, id)),
    )
    if (!located) {
      return yield* new SharingRejected({ reason: "InvalidInvitation" })
    }
    return yield* withSharingProject(userId, located.projectId, (tx) =>
      Effect.gen(function* () {
        const [invitation] = yield* sharingQuery(() =>
          tx
            .select()
            .from(projectInvitations)
            .where(eq(projectInvitations.id, id))
            .for("update"),
        )
        const [recipient] = yield* sharingQuery(() =>
          tx.select().from(user).where(eq(user.id, userId)),
        )
        if (
          !invitation ||
          invitation.state !== "pending" ||
          invitation.expiresAt.getTime() <= Date.now() ||
          invitation.tokenHash !== tokenHash ||
          !recipient?.emailVerified ||
          recipient.email !== invitation.email ||
          (invitation.recipientUserId !== null &&
            invitation.recipientUserId !== userId)
        ) {
          return yield* new SharingRejected({ reason: "InvalidInvitation" })
        }
        const owner = yield* sharingOwner(
          tx,
          invitation.inviterId,
          invitation.projectId,
        )
        const [project] = yield* sharingQuery(() =>
          tx
            .select({ name: projects.name })
            .from(projects)
            .where(eq(projects.id, invitation.projectId)),
        )
        if (action === "accept") {
          const [existing] = yield* sharingQuery(() =>
            tx
              .select()
              .from(projectMembers)
              .where(
                and(
                  eq(projectMembers.projectId, invitation.projectId),
                  eq(projectMembers.userId, userId),
                ),
              ),
          )
          const members = yield* sharingQuery(() =>
            tx
              .select({ id: projectMembers.userId })
              .from(projectMembers)
              .where(eq(projectMembers.projectId, invitation.projectId))
              .limit(25),
          )
          if (!existing && members.length >= 25) {
            return yield* new SharingRejected({ reason: "LimitReached" })
          }
          if (!existing) {
            yield* sharingQuery(() =>
              tx.insert(projectMembers).values({
                userId,
                projectId: invitation.projectId,
                role: invitation.role,
              }),
            )
          }
        }
        if (action !== "review") {
          yield* sharingQuery(() =>
            tx
              .update(projectInvitations)
              .set({
                state: action === "accept" ? "accepted" : "declined",
                tokenHash: null,
                recipientUserId: userId,
                updatedAt: new Date(),
              })
              .where(eq(projectInvitations.id, id)),
          )
        }
        return {
          projectId: invitation.projectId,
          projectName: project.name,
          inviterName: owner.name,
          expiresAt: invitation.expiresAt.toISOString(),
          role: invitation.role,
          action,
        }
      }),
    )
  },
)
