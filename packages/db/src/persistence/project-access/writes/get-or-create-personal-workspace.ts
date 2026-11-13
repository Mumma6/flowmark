import { eq, sql } from "drizzle-orm"
import { Effect } from "effect"
import { personalWorkspaces, user, workspaces } from "../../../schema/index.js"
import { Database, DatabaseError } from "../../database.js"
import { DatabaseOperation } from "../../database-operation.js"
import { runTransaction } from "../../run-transaction.js"
import { runQuery } from "../../run-query.js"

/** Lazily allocate a personal creation target; membership never chooses it. */
export const getOrCreatePersonalWorkspace = Effect.fn(
  "getOrCreatePersonalWorkspace",
)(function* (userId: string) {
  const db = yield* Database
  return yield* runTransaction(
    DatabaseOperation.GetWorkspaceForUser,
    (use) => db.transaction(use),
    (tx) =>
      Effect.gen(function* () {
        yield* runQuery(DatabaseOperation.GetWorkspaceForUser, () =>
          tx.execute(sql`SET LOCAL lock_timeout = '3s'`),
        )
        const [actor] = yield* runQuery(
          DatabaseOperation.GetWorkspaceForUser,
          () => tx.select().from(user).where(eq(user.id, userId)).for("update"),
        )
        if (!actor || actor.lifecycleOperationId !== null) {
          return yield* new DatabaseError({
            operation: DatabaseOperation.GetWorkspaceForUser,
            cause: "Account unavailable.",
          })
        }
        const [existing] = yield* runQuery(
          DatabaseOperation.GetWorkspaceForUser,
          () =>
            tx
              .select()
              .from(personalWorkspaces)
              .where(eq(personalWorkspaces.userId, userId)),
        )
        if (existing) {
          return existing.workspaceId
        }
        const [workspace] = yield* runQuery(
          DatabaseOperation.GetWorkspaceForUser,
          () =>
            tx
              .insert(workspaces)
              .values({ name: "Personal projects" })
              .returning({ id: workspaces.id }),
        )
        yield* runQuery(DatabaseOperation.GetWorkspaceForUser, () =>
          tx
            .insert(personalWorkspaces)
            .values({ userId, workspaceId: workspace.id }),
        )
        return workspace.id
      }),
  )
})
