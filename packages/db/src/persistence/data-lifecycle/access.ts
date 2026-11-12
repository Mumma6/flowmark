import { and, eq, sql } from "drizzle-orm"
import { Array, Effect } from "effect"
import { projectMembers, projects } from "../../schema/index.js"
import { DatabaseOperation } from "../database-operation.js"
import { runQuery } from "../run-query.js"
import { DatabaseError } from "../database.js"
import type { DatabaseTransaction } from "../run-transaction.js"
import { LifecycleRejected } from "./types.js"

export const lifecycleQuery = <A>(query: () => Promise<A>) =>
  runQuery(DatabaseOperation.DataLifecycle, query)

export const lockLifecycleProject = Effect.fn("lockLifecycleProject")(
  function* (tx: DatabaseTransaction, userId: string, projectId: string) {
    yield* lifecycleQuery(() =>
      tx.execute(sql`set local statement_timeout = '5s'`),
    )
    yield* lifecycleQuery(() => tx.execute(sql`set local lock_timeout = '3s'`))
    const [project] = yield* lifecycleQuery(() =>
      tx
        .select()
        .from(projects)
        .where(eq(projects.id, projectId))
        .for("update"),
    )
    const members = yield* lifecycleQuery(() =>
      tx
        .select({ userId: projectMembers.userId, role: projectMembers.role })
        .from(projectMembers)
        .where(eq(projectMembers.projectId, projectId))
        .limit(2),
    )
    if (
      !project ||
      !Array.some(
        members,
        (member) => member.userId === userId && member.role === "owner",
      )
    ) {
      return yield* new LifecycleRejected({ reason: "Unauthorized" })
    }
    if (members.length !== 1) {
      return yield* new LifecycleRejected({ reason: "SharedProject" })
    }
    // The project lock is also held by membership writes through the migration guard.
    yield* lifecycleQuery(() =>
      tx
        .select({ id: projectMembers.userId })
        .from(projectMembers)
        .where(
          and(
            eq(projectMembers.projectId, projectId),
            eq(projectMembers.userId, userId),
          ),
        )
        .for("share"),
    )
    return project
  },
)

export const lifecycleDeadline = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  effect.pipe(
    Effect.timeout("10 seconds"),
    Effect.catchTag("TimeoutError", (cause) =>
      Effect.fail(
        new DatabaseError({
          operation: DatabaseOperation.DataLifecycle,
          cause,
        }),
      ),
    ),
  )
