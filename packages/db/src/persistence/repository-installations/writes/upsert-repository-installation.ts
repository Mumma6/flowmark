import { Effect } from "effect"
import { repositoryInstallations } from "../../../schema/index.js"
import { Database } from "../../database.js"
import { DatabaseOperation } from "../../database-operation.js"
import { withOwnerProject } from "../../project-access/with-owner-project.js"
import { runQuery } from "../../run-query.js"
import type {
  StoredRepositoryInstallation,
  UpsertRepositoryInstallationInput,
} from "../types.js"

export const upsertRepositoryInstallation = Effect.fn(
  "upsertRepositoryInstallation",
)(function* (userId: string, input: UpsertRepositoryInstallationInput) {
  return yield* withOwnerProject(
    userId,
    input.projectId,
    Effect.gen(function* () {
      const db = yield* Database
      const now = new Date()
      const delegated = input.delegatedGrantFamily
      const [row] = yield* runQuery(
        DatabaseOperation.RepositoryInstallation,
        () =>
          db
            .insert(repositoryInstallations)
            .values({
              projectId: input.projectId,
              bindingId: input.bindingId,
              host: input.host,
              runtime: input.runtime,
              repository: input.repository,
              service: input.service,
              environment: input.environment,
              externalInstallationId: input.externalInstallationId,
              policy: input.policy,
              status: "pending-verification",
              coldStartStatus: "pending-deployment-receipt",
              delegatedAuthorizationCodeId:
                delegated?.authorizationCodeId ?? null,
              delegatedClientId: delegated?.clientId ?? null,
              delegatedUserId: delegated ? userId : null,
              revokedAt: null,
              updatedAt: now,
            })
            .onConflictDoUpdate({
              target: [
                repositoryInstallations.projectId,
                repositoryInstallations.host,
                repositoryInstallations.repository,
                repositoryInstallations.service,
                repositoryInstallations.environment,
              ],
              set: {
                bindingId: input.bindingId,
                runtime: input.runtime,
                externalInstallationId: input.externalInstallationId,
                policy: input.policy,
                status: "pending-verification",
                delegatedAuthorizationCodeId:
                  delegated?.authorizationCodeId ?? null,
                delegatedClientId: delegated?.clientId ?? null,
                delegatedUserId: delegated ? userId : null,
                revokedAt: null,
                updatedAt: now,
              },
            })
            .returning(),
      )
      if (!row) {
        return yield* Effect.die(
          "Repository installation upsert did not return a record",
        )
      }
      return row satisfies StoredRepositoryInstallation
    }),
  )
})
