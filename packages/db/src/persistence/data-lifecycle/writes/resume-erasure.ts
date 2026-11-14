import { and, eq, sql } from "drizzle-orm"
import { Array, Effect } from "effect"
import { dataLifecycleOperations } from "../../../schema/data-lifecycle.js"
import { projects, workspaces } from "../../../schema/index.js"
import { Database } from "../../database.js"
import { DatabaseOperation } from "../../database-operation.js"
import { runTransaction } from "../../run-transaction.js"
import {
  lifecycleDeadline,
  lifecycleQuery,
  lockLifecycleProject,
} from "../access.js"
import {
  EVENT_ERASURE_PHASE,
  RUN_ERASURE_PHASE,
  erasureBatchSql,
  finalErasurePhase,
} from "../sql/erasure-batch.js"
import { redactErasureScope } from "../redact-erasure-scope.js"
import { LifecycleRejected } from "../types.js"

export const resumeErasure = Effect.fn("resumeErasure")(function* (
  userId: string,
  projectId: string,
  operationId: string,
) {
  const db = yield* Database
  return yield* runTransaction(
    DatabaseOperation.DataLifecycle,
    (use) => db.transaction(use),
    (tx) =>
      Effect.gen(function* () {
        // The operation can outlive its project. Authenticate by immutable actor ID,
        // never by project UUID possession or an email reused by a later account.
        const [known] = yield* lifecycleQuery(() =>
          tx
            .select()
            .from(dataLifecycleOperations)
            .where(
              and(
                eq(dataLifecycleOperations.id, operationId),
                eq(dataLifecycleOperations.actorId, userId),
                eq(dataLifecycleOperations.projectId, projectId),
              ),
            ),
        )
        if (!known) {
          return yield* new LifecycleRejected({ reason: "Unauthorized" })
        }
        if (known.contractVersion !== 1) {
          return yield* new LifecycleRejected({ reason: "UnsupportedVersion" })
        }
        if (known.state === "live_data_deleted") {
          return known
        }
        const project = yield* lockLifecycleProject(tx, userId, projectId)
        const [operation] = yield* lifecycleQuery(() =>
          tx
            .select()
            .from(dataLifecycleOperations)
            .where(eq(dataLifecycleOperations.id, operationId))
            .for("update"),
        )
        if (
          operation.state !== "purging" ||
          project.lifecycleOperationId !== operationId
        ) {
          return yield* new LifecycleRejected({ reason: "Unavailable" })
        }
        yield* lifecycleQuery(() =>
          tx.execute(
            sql`select set_config('flowmark.cleanup_operation', ${operationId}, true)`,
          ),
        )
        const phase = operation.phase
        if (phase < 0 || phase > finalErasurePhase(operation)) {
          return yield* new LifecycleRejected({ reason: "Unavailable" })
        }
        const batch = erasureBatchSql(operation, project.credentialEpoch)
        const affected = batch
          ? yield* lifecycleQuery(() => tx.execute(batch))
          : []
        const lastPhase = finalErasurePhase(operation)
        const done = phase === lastPhase && affected.length === 0
        if (done && operation.scope.kind === "project") {
          yield* lifecycleQuery(() =>
            tx
              .select({ id: workspaces.id })
              .from(workspaces)
              .where(eq(workspaces.id, project.workspaceId))
              .for("update"),
          )
          const deleted = yield* lifecycleQuery(() =>
            tx
              .delete(projects)
              .where(eq(projects.id, projectId))
              .returning({ id: projects.id }),
          )
          if (deleted.length !== 1) {
            return yield* new LifecycleRejected({ reason: "Unavailable" })
          }
          yield* lifecycleQuery(() =>
            tx
              .delete(workspaces)
              .where(
                and(
                  eq(workspaces.id, project.workspaceId),
                  sql`NOT EXISTS (SELECT 1 FROM projects WHERE workspace_id = ${project.workspaceId}::uuid)`,
                  sql`NOT EXISTS (SELECT 1 FROM personal_workspaces WHERE workspace_id = ${project.workspaceId}::uuid)`,
                ),
              ),
          )
        } else if (done) {
          yield* lifecycleQuery(() =>
            tx
              .update(projects)
              .set({ lifecycleOperationId: null })
              .where(eq(projects.id, projectId)),
          )
        }
        const changes = {
          phase: affected.length ? phase : phase + 1,
          state: done ? ("live_data_deleted" as const) : ("purging" as const),
          deletedEvents:
            operation.deletedEvents +
            (phase === EVENT_ERASURE_PHASE ? affected.length : 0),
          deletedRuns:
            operation.deletedRuns +
            (phase === RUN_ERASURE_PHASE
              ? Array.filter(affected, (row) => row.deletedRun === true).length
              : 0),
          failureCode: null,
          ...(done
            ? {
                completedAt: new Date(),
                expiresAt: new Date(Date.now() + 30 * 86400_000),
                projectName: "",
                scope: redactErasureScope(operation.scope),
                counts: {
                  ...operation.counts,
                  latestStart: null,
                  revision: "",
                },
              }
            : {}),
        }
        const [updated] = yield* lifecycleQuery(() =>
          tx
            .update(dataLifecycleOperations)
            .set(changes)
            .where(eq(dataLifecycleOperations.id, operationId))
            .returning(),
        )
        return updated
      }),
  ).pipe(
    lifecycleDeadline,
    Effect.tapErrorTag("DatabaseError", () =>
      lifecycleQuery(() =>
        db
          .update(dataLifecycleOperations)
          .set({ failureCode: "BatchFailed" })
          .where(
            and(
              eq(dataLifecycleOperations.id, operationId),
              eq(dataLifecycleOperations.actorId, userId),
              eq(dataLifecycleOperations.state, "purging"),
            ),
          ),
      ),
    ),
  )
})
