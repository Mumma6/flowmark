import { randomUUID } from "node:crypto"
import { and, eq, sql } from "drizzle-orm"
import { Effect, Option } from "effect"
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

export const createProjectInvitation = Effect.fn("createProjectInvitation")(
  function* (
    userId: string,
    projectId: string,
    email: string,
    tokenHash: string,
    role: "viewer" | "business" = "viewer",
  ) {
    const db = yield* Database
    // Lookup only discovers lock IDs. Authority and recipient identity are rechecked below.
    const [located] = yield* sharingQuery(() =>
      db.select({ id: user.id }).from(user).where(eq(user.email, email)),
    )
    return yield* withSharingProject(
      userId,
      projectId,
      (tx) =>
        Effect.gen(function* () {
          const owner = yield* sharingOwner(tx, userId, projectId)
          if (!owner.verified || owner.email === email) {
            return yield* new SharingRejected({ reason: "Unauthorized" })
          }
          const [recipient] = yield* sharingQuery(() =>
            tx.select({ id: user.id }).from(user).where(eq(user.email, email)),
          )
          if (recipient?.id !== located?.id) {
            return yield* new SharingRejected({ reason: "Unavailable" })
          }
          const [existing] = yield* sharingQuery(() =>
            tx
              .select({ id: projectMembers.userId })
              .from(projectMembers)
              .where(
                and(
                  eq(projectMembers.projectId, projectId),
                  eq(projectMembers.userId, recipient?.id ?? ""),
                ),
              ),
          )
          if (existing) {
            return Option.none()
          }
          const [count] = yield* sharingQuery(() =>
            tx.execute<{ members: number; pending: number }>(
              sql`SELECT (SELECT count(*)::int FROM project_members WHERE project_id = ${projectId}::uuid) AS members, (SELECT count(*)::int FROM project_invitations WHERE project_id = ${projectId}::uuid AND state = 'pending' AND expires_at > clock_timestamp() AND email <> ${email}) AS pending`,
            ),
          )
          if (count.members >= 25 || count.pending >= 25) {
            return yield* new SharingRejected({ reason: "LimitReached" })
          }
          yield* sharingQuery(() =>
            tx
              .update(projectInvitations)
              .set({ state: "revoked", tokenHash: null, updatedAt: new Date() })
              .where(
                sql`${projectInvitations.projectId} = ${projectId}::uuid AND ${projectInvitations.state} = 'pending' AND (${projectInvitations.email} = ${email} OR ${projectInvitations.expiresAt} <= clock_timestamp())`,
              ),
          )
          const [invitation] = yield* sharingQuery(() =>
            tx
              .insert(projectInvitations)
              .values({
                id: randomUUID(),
                projectId,
                inviterId: userId,
                recipientUserId: recipient?.id ?? null,
                email,
                tokenHash,
                role,
                expiresAt: new Date(Date.now() + 72 * 3600000),
              })
              .returning(),
          )
          const [project] = yield* sharingQuery(() =>
            tx
              .select({ name: projects.name })
              .from(projects)
              .where(eq(projects.id, projectId)),
          )
          return Option.some({
            invitation,
            projectName: project.name,
            inviterName: owner.name,
          })
        }),
      located?.id,
    )
  },
)
export const markInvitationDelivery = Effect.fn("markInvitationDelivery")(
  function* (id: string, tokenHash: string, delivery: "submitted" | "failed") {
    const db = yield* Database
    yield* sharingQuery(() =>
      db
        .update(projectInvitations)
        .set({ delivery, updatedAt: new Date() })
        .where(
          and(
            eq(projectInvitations.id, id),
            eq(projectInvitations.tokenHash, tokenHash),
            eq(projectInvitations.state, "pending"),
          ),
        ),
    )
  },
)
