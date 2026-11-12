import { and, eq, sql } from "drizzle-orm"
import { Effect } from "effect"
import { dataLifecycleOperations } from "../../../schema/data-lifecycle.js"
import { projects } from "../../../schema/index.js"
import { Database } from "../../database.js"
import { DatabaseOperation } from "../../database-operation.js"
import { runTransaction } from "../../run-transaction.js"
import {
  lifecycleDeadline,
  lifecycleQuery,
  lockLifecycleProject,
} from "../access.js"
import { getErasureCounts } from "../queries/get-erasure-counts.js"
import { LifecycleRejected } from "../types.js"

export const confirmErasure = Effect.fn("confirmErasure")(function* (
  userId: string,
  projectId: string,
  operationId: string,
  confirmation: string,
) {
  const db = yield* Database
  return yield* runTransaction(
    DatabaseOperation.DataLifecycle,
    (use) => db.transaction(use),
    (tx) =>
      Effect.gen(function* () {
        const project = yield* lockLifecycleProject(tx, userId, projectId)
        const [operation] = yield* lifecycleQuery(() =>
          tx
            .select()
            .from(dataLifecycleOperations)
            .where(
              and(
                eq(dataLifecycleOperations.id, operationId),
                eq(dataLifecycleOperations.projectId, projectId),
                eq(dataLifecycleOperations.actorId, userId),
              ),
            )
            .for("update"),
        )
        if (operation && operation.contractVersion !== 1) {
          return yield* new LifecycleRejected({ reason: "Unavailable" })
        }
        if (!operation) {
          return yield* new LifecycleRejected({ reason: "Unauthorized" })
        }
        if (operation.state === "cancelled") {
          return yield* new LifecycleRejected({ reason: "StalePreview" })
        }
        if (
          confirmation !== operation.projectName ||
          confirmation !== project.name
        ) {
          return yield* new LifecycleRejected({
            reason: "ConfirmationRequired",
          })
        }
        if (
          operation.state === "purging" &&
          project.lifecycleOperationId === operationId
        ) {
          return operation
        }
        if (
          operation.state !== "previewed" ||
          operation.expiresAt.getTime() <= Date.now() ||
          project.lifecycleOperationId
        ) {
          return yield* new LifecycleRejected({ reason: "StalePreview" })
        }
        const counts = yield* getErasureCounts(
          tx,
          projectId,
          operation.scope,
          operation.createdAt,
        )
        // New runs outside the frozen cutoff must also make whole-project previews stale.
        const current =
          operation.scope.kind === "project"
            ? yield* getErasureCounts(
                tx,
                projectId,
                operation.scope,
                new Date(),
              )
            : counts
        if (current.revision !== operation.counts.revision) {
          return yield* new LifecycleRejected({ reason: "StalePreview" })
        }
        yield* lifecycleQuery(() =>
          tx
            .update(projects)
            .set({
              lifecycleOperationId: operationId,
              credentialEpoch: sql`${projects.credentialEpoch} + 1`,
              newRunAfter: sql`greatest(${projects.newRunAfter}, clock_timestamp(), ${counts.latestStart}::timestamptz)`,
            })
            .where(eq(projects.id, projectId)),
        )
        const [confirmed] = yield* lifecycleQuery(() =>
          tx
            .update(dataLifecycleOperations)
            .set({
              state: "purging",
              expiresAt: new Date(Date.now() + 30 * 86400_000),
            })
            .where(eq(dataLifecycleOperations.id, operationId))
            .returning(),
        )
        return confirmed
      }),
  ).pipe(lifecycleDeadline)
})
