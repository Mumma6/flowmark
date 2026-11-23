import { and, eq } from "drizzle-orm"
import { Effect } from "effect"
import { repositoryInstallations } from "../../../schema/index.js"
import { Database } from "../../database.js"
import { DatabaseOperation } from "../../database-operation.js"
import { withActiveProject } from "../../data-lifecycle/with-active-project.js"
import { withOwnerProject } from "../../project-access/with-owner-project.js"
import { runQuery } from "../../run-query.js"
import type { StoredRepositoryInstallation } from "../types.js"

export const getRepositoryInstallation = Effect.fn("getRepositoryInstallation")(
  function* (userId: string, projectId: string, installationId: string) {
    return yield* withOwnerProject(
      userId,
      projectId,
      Effect.gen(function* () {
        const db = yield* Database
        const [row] = yield* runQuery(
          DatabaseOperation.RepositoryInstallation,
          () =>
            db
              .select()
              .from(repositoryInstallations)
              .where(
                and(
                  eq(repositoryInstallations.projectId, projectId),
                  eq(repositoryInstallations.id, installationId),
                ),
              ),
        )
        return (row ?? null) as StoredRepositoryInstallation | null
      }),
    )
  },
)

export const getRepositoryInstallationForProject = Effect.fn(
  "getRepositoryInstallationForProject",
)(function* (projectId: string, installationId: string) {
  return yield* withActiveProject(
    projectId,
    Effect.gen(function* () {
      const db = yield* Database
      const [row] = yield* runQuery(
        DatabaseOperation.RepositoryInstallation,
        () =>
          db
            .select()
            .from(repositoryInstallations)
            .where(
              and(
                eq(repositoryInstallations.projectId, projectId),
                eq(repositoryInstallations.id, installationId),
              ),
            ),
      )
      return (row ?? null) as StoredRepositoryInstallation | null
    }),
  )
})
