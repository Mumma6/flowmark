import { and, eq } from "drizzle-orm"
import { Effect } from "effect"
import { repositoryInstallations } from "../../../schema/index.js"
import { withActiveProject } from "../../data-lifecycle/with-active-project.js"
import { Database } from "../../database.js"
import { DatabaseOperation } from "../../database-operation.js"
import { ProjectReadSubject } from "../../project-access/read-subject.js"
import { runQuery } from "../../run-query.js"
import type {
  RecordInstallationPrInput,
  StoredRepositoryInstallation,
} from "../types.js"

export const recordInstallationPr = Effect.fn("recordInstallationPr")(
  function* (input: RecordInstallationPrInput) {
    return yield* withActiveProject(
      input.projectId,
      Effect.gen(function* () {
        const db = yield* Database
        const [updated] = yield* runQuery(
          DatabaseOperation.RepositoryInstallation,
          () =>
            db
              .update(repositoryInstallations)
              .set({
                prBranch: input.branch,
                prNumber: input.number,
                prUrl: input.url,
                prHeadSha: input.headSha,
                updatedAt: new Date(),
              })
              .where(
                and(
                  eq(repositoryInstallations.projectId, input.projectId),
                  eq(repositoryInstallations.id, input.installationId),
                ),
              )
              .returning(),
        )
        return (updated ?? null) as StoredRepositoryInstallation | null
      }),
      "current",
    ).pipe(Effect.provideService(ProjectReadSubject, undefined))
  },
)
