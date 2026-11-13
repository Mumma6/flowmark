import { and, eq, sql } from "drizzle-orm"
import { Effect } from "effect"
import { projectInvitations, projectMembers } from "../../../schema/index.js"
import { SharingRejected } from "../types.js"
import {
  sharingOwner,
  sharingQuery,
  withSharingProject,
} from "../with-sharing-project.js"
import { invalidateAgentConsentResourcesInTransaction } from "../../project-access/writes/invalidate-agent-consent-resources-in-transaction.js"

export const removeProjectViewer = Effect.fn("removeProjectViewer")(function* (
  userId: string,
  projectId: string,
  targetId: string,
) {
  return yield* withSharingProject(
    userId,
    projectId,
    (tx) =>
      Effect.gen(function* () {
        if (userId !== targetId) {
          yield* sharingOwner(tx, userId, projectId)
        }
        const [member] = yield* sharingQuery(() =>
          tx
            .select()
            .from(projectMembers)
            .where(
              and(
                eq(projectMembers.projectId, projectId),
                eq(projectMembers.userId, targetId),
              ),
            ),
        )
        if (!member || member.role !== "viewer") {
          return yield* new SharingRejected({ reason: "Unauthorized" })
        }
        const [target] = yield* sharingQuery(() =>
          tx.execute<{ pending: string | null }>(
            sql`SELECT lifecycle_operation_id AS pending FROM "user" WHERE id = ${targetId}`,
          ),
        )
        // Clear only this project's selections; unrelated grant families stay usable.
        const families = yield* sharingQuery(() =>
          tx.execute<{
            code: string
          }>(sql`SELECT DISTINCT g.authorization_code_id AS code
            FROM agent_access_grant_projects g WHERE g.project_id = ${projectId}::uuid
            AND (EXISTS (SELECT 1 FROM oauth_refresh_token t WHERE t.authorization_code_id = g.authorization_code_id AND t.user_id = ${targetId})
              OR EXISTS (SELECT 1 FROM agent_access_oauth_consent_intents i WHERE i.authorization_code_id = g.authorization_code_id AND i.user_id = ${targetId}))`),
        )
        if (target?.pending === null) {
          yield* Effect.forEach(families, ({ code }) =>
            sharingQuery(() =>
              invalidateAgentConsentResourcesInTransaction(tx, {
                userId: targetId,
                authorizationCodeId: code,
                now: new Date(),
              }),
            ).pipe(
              Effect.andThen(
                sharingQuery(() =>
                  tx.execute(
                    sql`UPDATE agent_access_oauth_consent_intents SET state = 'revoked', updated_at = clock_timestamp() WHERE user_id = ${targetId} AND authorization_code_id = ${code}`,
                  ),
                ),
              ),
            ),
          )
        }
        yield* Effect.forEach(families, ({ code }) =>
          sharingQuery(() =>
            tx.execute(
              sql`DELETE FROM agent_access_grant_projects WHERE project_id = ${projectId}::uuid AND authorization_code_id = ${code}`,
            ),
          ),
        )
        yield* sharingQuery(() =>
          tx
            .delete(projectMembers)
            .where(
              and(
                eq(projectMembers.projectId, projectId),
                eq(projectMembers.userId, targetId),
              ),
            ),
        )
        return { removed: true as const }
      }),
    targetId,
    true,
  )
})
export const revokeProjectInvitation = Effect.fn("revokeProjectInvitation")(
  function* (userId: string, projectId: string, id: string) {
    return yield* withSharingProject(userId, projectId, (tx) =>
      Effect.gen(function* () {
        yield* sharingOwner(tx, userId, projectId)
        const rows = yield* sharingQuery(() =>
          tx
            .update(projectInvitations)
            .set({ state: "revoked", tokenHash: null, updatedAt: new Date() })
            .where(
              and(
                eq(projectInvitations.id, id),
                eq(projectInvitations.projectId, projectId),
                eq(projectInvitations.state, "pending"),
              ),
            )
            .returning({ id: projectInvitations.id }),
        )
        if (rows.length !== 1) {
          return yield* new SharingRejected({ reason: "InvalidInvitation" })
        }
        return { revoked: true as const }
      }),
    )
  },
)
