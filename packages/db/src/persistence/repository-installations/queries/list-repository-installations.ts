import { desc, eq } from "drizzle-orm"
import { Effect } from "effect"
import { repositoryInstallations } from "../../../schema/index.js"
import { Database } from "../../database.js"
import { DatabaseOperation } from "../../database-operation.js"
import { withOwnerProject } from "../../project-access/with-owner-project.js"
import { runQuery } from "../../run-query.js"
import type { StoredRepositoryInstallation } from "../types.js"

export const listRepositoryInstallations = Effect.fn(
  "listRepositoryInstallations",
)(function* (userId: string, projectId: string) {
  return yield* withOwnerProject(
    userId,
    projectId,
    Effect.gen(function* () {
      const db = yield* Database
      const rows = yield* runQuery(
        DatabaseOperation.RepositoryInstallation,
        () =>
          db
            .select()
            .from(repositoryInstallations)
            .where(eq(repositoryInstallations.projectId, projectId))
            .orderBy(desc(repositoryInstallations.updatedAt)),
      )
      return rows satisfies ReadonlyArray<StoredRepositoryInstallation>
    }),
  )
})
