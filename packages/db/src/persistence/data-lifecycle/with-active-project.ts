import {
  ProjectReadSubject,
  assertProjectReadSubject,
} from "../project-access/read-subject.js"
import { lockActiveProjectOwners } from "../account-lifecycle/active-account.js"
import { and, eq, isNull, sql } from "drizzle-orm"
import { Effect } from "effect"
import { projects } from "../../schema/index.js"
import type { FlowmarkDatabase } from "../../client.js"
import { Database, DatabaseError } from "../database.js"
import { DatabaseOperation } from "../database-operation.js"
import { runQuery } from "../run-query.js"
import { runTransaction } from "../run-transaction.js"

/** Hold admission through the whole read/write, including nested savepoints. */
export const withActiveProject = Effect.fn("withActiveProject")(function* <
  A,
  E,
>(
  projectId: string,
  use: Effect.Effect<A, E, FlowmarkDatabase>,
  consistency: "snapshot" | "current" = "snapshot",
  lock: "share" | "update" = "share",
) {
  const db = yield* Database
  const subject = yield* ProjectReadSubject
  return yield* runTransaction(
    DatabaseOperation.ProjectReadFence,
    (body) =>
      db.transaction(body, {
        isolationLevel:
          consistency === "snapshot" ? "repeatable read" : "read committed",
      }),
    (tx) =>
      Effect.gen(function* () {
        if (lock === "update") {
          yield* runQuery(DatabaseOperation.ProjectReadFence, () =>
            tx.execute(sql`SET LOCAL statement_timeout = '5s'`),
          )
          yield* runQuery(DatabaseOperation.ProjectReadFence, () =>
            tx.execute(sql`SET LOCAL lock_timeout = '3s'`),
          )
        }
        yield* lockActiveProjectOwners(
          tx,
          projectId,
          subject && subject.kind !== "key" ? subject.userId : undefined,
        )
        const rows = yield* runQuery(DatabaseOperation.ProjectReadFence, () =>
          tx
            .select({ id: projects.id })
            .from(projects)
            .where(
              and(
                eq(projects.id, projectId),
                isNull(projects.lifecycleOperationId),
              ),
            )
            .for(lock),
        )
        if (!rows.length) {
          return yield* new DatabaseError({
            operation: DatabaseOperation.ProjectReadFence,
            cause: "Project unavailable.",
          })
        }
        yield* assertProjectReadSubject(tx, projectId, subject)
        // Drizzle transaction implements the query/transaction surface consumed here.
        return yield* use.pipe(
          Effect.provideService(Database, tx as unknown as FlowmarkDatabase),
        )
      }),
  )
})
