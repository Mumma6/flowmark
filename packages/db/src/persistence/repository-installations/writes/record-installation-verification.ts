import type { RepositoryColdStartStatus } from "@flowmarkdev/core"
import { and, eq } from "drizzle-orm"
import { Effect } from "effect"
import { repositoryInstallations } from "../../../schema/index.js"
import { withActiveProject } from "../../data-lifecycle/with-active-project.js"
import { Database } from "../../database.js"
import { DatabaseOperation } from "../../database-operation.js"
import { ProjectReadSubject } from "../../project-access/read-subject.js"
import { runQuery } from "../../run-query.js"
import type { StoredRepositoryInstallation } from "../types.js"

export const recordInstallationVerification = Effect.fn(
  "recordInstallationVerification",
)(function* (input: {
  readonly projectId: string
  readonly installationId: string
  readonly runId: string
  readonly coldStartStatus: RepositoryColdStartStatus
}) {
  return yield* withActiveProject(
    input.projectId,
    Effect.gen(function* () {
      const db = yield* Database
      const now = new Date()
      const [updated] = yield* runQuery(
        DatabaseOperation.RepositoryInstallation,
        () =>
          db
            .update(repositoryInstallations)
            .set({
              status: "active",
              coldStartStatus: input.coldStartStatus,
              verifiedRunId: input.runId,
              verifiedAt: now,
              updatedAt: now,
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
})
