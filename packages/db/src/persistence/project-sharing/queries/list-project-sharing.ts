import { and, eq, gt } from "drizzle-orm"
import { Array, Effect, Option } from "effect"
import {
  projectInvitations,
  projectMembers,
  projects,
  user,
} from "../../../schema/index.js"
import { SharingRejected } from "../types.js"
import { sharingQuery, withSharingProject } from "../with-sharing-project.js"

export const listProjectSharing = Effect.fn("listProjectSharing")(function* (
  userId: string,
  projectId: string,
) {
  return yield* withSharingProject(userId, projectId, (tx) =>
    Effect.gen(function* () {
      const members = yield* sharingQuery(() =>
        tx
          .select({
            userId: user.id,
            name: user.name,
            email: user.email,
            role: projectMembers.role,
          })
          .from(projectMembers)
          .innerJoin(user, eq(user.id, projectMembers.userId))
          .where(eq(projectMembers.projectId, projectId))
          .orderBy(projectMembers.createdAt, projectMembers.userId)
          .limit(26),
      )
      const member = Option.getOrUndefined(
        Array.findFirst(members, (row) => row.userId === userId),
      )
      const owner = Option.getOrUndefined(
        Array.findFirst(members, (row) => row.role === "owner"),
      )
      if (members.length > 25 || !owner || !member) {
        return yield* new SharingRejected({ reason: "Unauthorized" })
      }
      const invitations =
        member.role === "owner"
          ? yield* sharingQuery(() =>
              tx
                .select({
                  id: projectInvitations.id,
                  email: projectInvitations.email,
                  expiresAt: projectInvitations.expiresAt,
                  delivery: projectInvitations.delivery,
                })
                .from(projectInvitations)
                .where(
                  and(
                    eq(projectInvitations.projectId, projectId),
                    eq(projectInvitations.state, "pending"),
                    gt(projectInvitations.expiresAt, new Date()),
                  ),
                )
                .orderBy(projectInvitations.createdAt)
                .limit(25),
            )
          : []
      const [project] = yield* sharingQuery(() =>
        tx
          .select({ name: projects.name })
          .from(projects)
          .where(eq(projects.id, projectId)),
      )
      return {
        userId,
        projectId,
        projectName: project.name,
        role: member.role,
        ownerName: owner.name,
        members: member.role === "owner" ? members : [],
        invitations: Array.map(invitations, (row) => ({
          ...row,
          expiresAt: row.expiresAt.toISOString(),
        })),
      }
    }),
  )
})
