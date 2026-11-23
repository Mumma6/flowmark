import { and, eq } from "drizzle-orm"
import { Array, Effect, Option } from "effect"
import {
  repositoryInstallationDeliveries,
  repositoryInstallations,
} from "../../../schema/index.js"
import { withActiveProject } from "../../data-lifecycle/with-active-project.js"
import { Database } from "../../database.js"
import { DatabaseOperation } from "../../database-operation.js"
import { ProjectReadSubject } from "../../project-access/read-subject.js"
import { revokeGrantFamilyInTransaction } from "../../project-access/writes/revoke-grant-family-in-transaction.js"
import { runQuery } from "../../run-query.js"
import type {
  RecordInstallationDeliveryInput,
  RecordInstallationDeliveryOutcome,
  StoredRepositoryInstallation,
} from "../types.js"

export const recordInstallationDelivery = Effect.fn(
  "recordInstallationDelivery",
)(function* (input: RecordInstallationDeliveryInput) {
  const db = yield* Database
  const candidates = yield* runQuery(
    DatabaseOperation.RepositoryInstallation,
    () =>
      db
        .select()
        .from(repositoryInstallations)
        .where(
          and(
            eq(repositoryInstallations.host, input.host),
            eq(
              repositoryInstallations.externalInstallationId,
              input.externalInstallationId,
            ),
          ),
        ),
  )
  if (candidates.length === 0) {
    return { status: "not-found" } satisfies RecordInstallationDeliveryOutcome
  }
  const exact = Array.findFirst(
    candidates,
    (candidate) => candidate.repository === input.repository,
  )
  if (Option.isNone(exact)) {
    return {
      status: "foreign-repository",
      expectedRepository: candidates[0]!.repository,
    } satisfies RecordInstallationDeliveryOutcome
  }
  const target = exact.value

  return yield* withActiveProject(
    target.projectId,
    Effect.gen(function* () {
      const activeDb = yield* Database
      const now = new Date()
      return yield* runQuery(
        DatabaseOperation.RepositoryInstallationDelivery,
        () =>
          activeDb.transaction(async (tx) => {
            const [installation] = await tx
              .select()
              .from(repositoryInstallations)
              .where(
                and(
                  eq(repositoryInstallations.projectId, target.projectId),
                  eq(repositoryInstallations.id, target.id),
                ),
              )
              .for("update")
            if (!installation) {
              return {
                status: "not-found",
              } satisfies RecordInstallationDeliveryOutcome
            }
            const [existingDelivery] = await tx
              .select({
                deliveryId: repositoryInstallationDeliveries.deliveryId,
              })
              .from(repositoryInstallationDeliveries)
              .where(
                and(
                  eq(
                    repositoryInstallationDeliveries.projectId,
                    installation.projectId,
                  ),
                  eq(
                    repositoryInstallationDeliveries.installationId,
                    installation.id,
                  ),
                  eq(
                    repositoryInstallationDeliveries.deliveryId,
                    input.deliveryId,
                  ),
                ),
              )
            if (existingDelivery) {
              return {
                status: "duplicate",
                installation: installation as StoredRepositoryInstallation,
              } satisfies RecordInstallationDeliveryOutcome
            }
            if (installation.status === "revoked") {
              return {
                status: "revoked",
                installation: installation as StoredRepositoryInstallation,
              } satisfies RecordInstallationDeliveryOutcome
            }
            if (
              installation.lastEventAt !== null &&
              input.sentAt.getTime() < installation.lastEventAt.getTime()
            ) {
              return {
                status: "stale",
                installation: installation as StoredRepositoryInstallation,
              } satisfies RecordInstallationDeliveryOutcome
            }
            await tx.insert(repositoryInstallationDeliveries).values({
              projectId: installation.projectId,
              installationId: installation.id,
              deliveryId: input.deliveryId,
              action: input.action,
              sentAt: input.sentAt,
              receivedAt: now,
            })
            if (input.revoke) {
              if (
                installation.delegatedUserId &&
                installation.delegatedAuthorizationCodeId &&
                installation.delegatedClientId
              ) {
                await revokeGrantFamilyInTransaction(tx, {
                  now,
                  userId: installation.delegatedUserId,
                  authorizationCodeId:
                    installation.delegatedAuthorizationCodeId,
                  clientId: installation.delegatedClientId,
                  markConsentIntentsRevoked: true,
                })
              }
              const [updated] = await tx
                .update(repositoryInstallations)
                .set({
                  status: "revoked",
                  revokedAt: now,
                  lastEventAt: input.sentAt,
                  updatedAt: now,
                })
                .where(
                  and(
                    eq(
                      repositoryInstallations.projectId,
                      installation.projectId,
                    ),
                    eq(repositoryInstallations.id, installation.id),
                  ),
                )
                .returning()
              return {
                status: "revoked-now",
                installation: (updated ??
                  installation) as StoredRepositoryInstallation,
              } satisfies RecordInstallationDeliveryOutcome
            }
            const [updated] = await tx
              .update(repositoryInstallations)
              .set({
                lastEventAt: input.sentAt,
                updatedAt: now,
              })
              .where(
                and(
                  eq(repositoryInstallations.projectId, installation.projectId),
                  eq(repositoryInstallations.id, installation.id),
                ),
              )
              .returning()
            return {
              status: "accepted",
              installation: (updated ??
                installation) as StoredRepositoryInstallation,
            } satisfies RecordInstallationDeliveryOutcome
          }),
      )
    }),
    "current",
  ).pipe(Effect.provideService(ProjectReadSubject, undefined))
})
