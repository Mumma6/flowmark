import { ProjectReadSubject } from "./read-subject.js"
import { and, eq } from "drizzle-orm"
import { Effect } from "effect"
import type { FlowmarkDatabase } from "../../client.js"
import { projectMembers, user } from "../../schema/index.js"
import { Database, DatabaseError } from "../database.js"
import { DatabaseOperation } from "../database-operation.js"
import { runQuery } from "../run-query.js"
import { withActiveProject } from "../data-lifecycle/with-active-project.js"

/** Owner identity is explicit and rechecked while the project fence is held. */
export const withOwnerProject = Effect.fn("withOwnerProject")(function* <A, E>(
  userId: string,
  projectId: string,
  use: Effect.Effect<A, E, FlowmarkDatabase>,
  exclusive = false,
) {
  return yield* withActiveProject(
    projectId,
    Effect.gen(function* () {
      const db = yield* Database
      const [owner] = yield* runQuery(DatabaseOperation.ProjectReadFence, () =>
        db
          .select({ id: projectMembers.userId })
          .from(projectMembers)
          .innerJoin(user, eq(user.id, projectMembers.userId))
          .where(
            and(
              eq(projectMembers.userId, userId),
              eq(projectMembers.projectId, projectId),
              eq(projectMembers.role, "owner"),
            ),
          )
          .for("share", { of: projectMembers }),
      )
      if (!owner) {
        return yield* new DatabaseError({
          operation: DatabaseOperation.ProjectReadFence,
          cause: "Project owner required.",
        })
      }
      return yield* use
    }),
    "current",
    exclusive ? "update" : "share",
  ).pipe(Effect.provideService(ProjectReadSubject, { kind: "user", userId }))
})
