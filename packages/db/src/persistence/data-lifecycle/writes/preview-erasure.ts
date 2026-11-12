import { and, eq, sql } from "drizzle-orm"
import { Effect } from "effect"
import { dataLifecycleOperations } from "../../../schema/data-lifecycle.js"
import { Database } from "../../database.js"
import { DatabaseOperation } from "../../database-operation.js"
import { runTransaction } from "../../run-transaction.js"
import {
  lifecycleDeadline,
  lifecycleQuery,
  lockLifecycleProject,
} from "../access.js"
import { getErasureCounts } from "../queries/get-erasure-counts.js"
import { LifecycleRejected, type ErasureScope } from "../types.js"

export const previewErasure = Effect.fn("previewErasure")(function* (
  userId: string,
  projectId: string,
  scope: ErasureScope,
) {
  const db = yield* Database
  return yield* runTransaction(
    DatabaseOperation.DataLifecycle,
    (use) => db.transaction(use),
    (tx) =>
      Effect.gen(function* () {
        const project = yield* lockLifecycleProject(tx, userId, projectId)
        if (project.lifecycleOperationId) {
          return yield* new LifecycleRejected({ reason: "Unavailable" })
        }
        // Replace the owner's unused preview instead of accumulating arbitrary request rows.
        yield* lifecycleQuery(() =>
          tx
            .delete(dataLifecycleOperations)
            .where(
              and(
                eq(dataLifecycleOperations.actorId, userId),
                eq(dataLifecycleOperations.projectId, projectId),
                eq(dataLifecycleOperations.state, "previewed"),
              ),
            ),
        )
        const [clock] = yield* lifecycleQuery(() =>
          tx.execute<{ cutoff: string }>(
            sql`SELECT date_trunc('milliseconds', clock_timestamp())::text AS cutoff`,
          ),
        )
        const cutoff = new Date(clock.cutoff)
        const counts = yield* getErasureCounts(tx, projectId, scope, cutoff)
        if (scope.kind === "runs" && counts.runs !== scope.runIds.length) {
          return yield* new LifecycleRejected({ reason: "StalePreview" })
        }
        const [operation] = yield* lifecycleQuery(() =>
          tx
            .insert(dataLifecycleOperations)
            .values({
              actorId: userId,
              projectId,
              projectName: project.name,
              scope,
              counts,
              createdAt: cutoff,
              expiresAt: new Date(cutoff.getTime() + 300_000),
            })
            .returning(),
        )
        return operation
      }),
  ).pipe(lifecycleDeadline)
})
