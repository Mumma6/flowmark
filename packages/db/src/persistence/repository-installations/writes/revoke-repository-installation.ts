import { and, eq } from "drizzle-orm"
import { Effect } from "effect"
import { repositoryInstallations } from "../../../schema/index.js"
import { Database } from "../../database.js"
import { DatabaseOperation } from "../../database-operation.js"
import { withOwnerProject } from "../../project-access/with-owner-project.js"
import { revokeGrantFamilyInTransaction } from "../../project-access/writes/revoke-grant-family-in-transaction.js"
import { runQuery } from "../../run-query.js"
import type { StoredRepositoryInstallation } from "../types.js"

export const revokeRepositoryInstallation = Effect.fn(
  "revokeRepositoryInstallation",
)(function* (userId: string, projectId: string, installationId: string) {
  return yield* withOwnerProject(
    userId,
    projectId,
    Effect.gen(function* () {
      const db = yield* Database
      const now = new Date()
      return yield* runQuery(DatabaseOperation.RepositoryInstallation, () =>
        db.transaction(async (tx) => {
          const [installation] = await tx
            .select()
            .from(repositoryInstallations)
            .where(
              and(
                eq(repositoryInstallations.projectId, projectId),
                eq(repositoryInstallations.id, installationId),
              ),
            )
            .for("update")
          if (!installation) {
            return null
          }
          if (
            installation.delegatedUserId &&
            installation.delegatedAuthorizationCodeId &&
            installation.delegatedClientId
          ) {
            await revokeGrantFamilyInTransaction(tx, {
              now,
              userId: installation.delegatedUserId,
              authorizationCodeId: installation.delegatedAuthorizationCodeId,
              clientId: installation.delegatedClientId,
              markConsentIntentsRevoked: true,
            })
          }
          const [updated] = await tx
            .update(repositoryInstallations)
            .set({
              status: "revoked",
              revokedAt: now,
              updatedAt: now,
            })
            .where(
              and(
                eq(repositoryInstallations.projectId, projectId),
                eq(repositoryInstallations.id, installationId),
              ),
            )
            .returning()
          return (updated ?? installation) as StoredRepositoryInstallation
        }),
      )
    }),
  )
})
