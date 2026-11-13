import { and, eq, sql } from "drizzle-orm"
import { Array, Effect, Option } from "effect"
import { accountLifecycleOperations } from "../../../schema/account-lifecycle.js"
import { projects, projectMembers, user } from "../../../schema/index.js"
import type { FlowmarkDatabase } from "../../../client.js"
import { Database, hashApiKey } from "../../database.js"
import { DatabaseOperation } from "../../database-operation.js"
import { runTransaction } from "../../run-transaction.js"
import {
  lifecycleDeadline,
  lifecycleQuery,
} from "../../data-lifecycle/access.js"
import { previewErasure } from "../../data-lifecycle/writes/preview-erasure.js"
import { confirmErasure } from "../../data-lifecycle/writes/confirm-erasure.js"
import { resumeErasure } from "../../data-lifecycle/writes/resume-erasure.js"
import { readCleanupCapability } from "../capability.js"
import { authErasureBatches } from "../sql/auth-erasure-batch.js"
import { AccountLifecycleRejected } from "../types.js"

export const resumeAccountErasure = Effect.fn("resumeAccountErasure")(
  function* (operationId: string, capability: string) {
    const db = yield* Database
    return yield* runTransaction(
      DatabaseOperation.DataLifecycle,
      (use) => db.transaction(use),
      (tx) =>
        Effect.gen(function* () {
          yield* lifecycleQuery(() =>
            tx.execute(sql`SET LOCAL statement_timeout = '5s'`),
          )
          yield* lifecycleQuery(() =>
            tx.execute(sql`SET LOCAL lock_timeout = '3s'`),
          )
          const operation = yield* readCleanupCapability(
            tx,
            operationId,
            capability,
            true,
          )
          if (operation.state === "live_data_deleted") {
            return operation
          }
          const [identity] = yield* lifecycleQuery(() =>
            tx
              .select({ pending: user.lifecycleOperationId })
              .from(user)
              .where(eq(user.id, operation.userId))
              .for("update"),
          )
          if (identity?.pending !== operation.id) {
            return yield* new AccountLifecycleRejected({
              reason: "Unavailable",
            })
          }
          yield* lifecycleQuery(() =>
            tx.execute(
              sql`SELECT set_config('flowmark.cleanup_operation', ${operationId}, true)`,
            ),
          )
          if (operation.phase === 0) {
            if (operation.childProjectId && operation.childOperationId) {
              const child = yield* resumeErasure(
                operation.userId,
                operation.childProjectId,
                operation.childOperationId,
              ).pipe(
                Effect.provideService(
                  Database,
                  tx as unknown as FlowmarkDatabase,
                ),
              )
              const [updated] = yield* lifecycleQuery(() =>
                tx
                  .update(accountLifecycleOperations)
                  .set({
                    failureCode: null,
                    ...(child.state === "live_data_deleted"
                      ? {
                          childProjectId: null,
                          childOperationId: null,
                          completedProjects: operation.completedProjects + 1,
                        }
                      : {}),
                  })
                  .where(eq(accountLifecycleOperations.id, operationId))
                  .returning(),
              )
              return updated
            }
            const [project] = yield* lifecycleQuery(() =>
              tx
                .select({ id: projects.id, name: projects.name })
                .from(projects)
                .innerJoin(
                  projectMembers,
                  eq(projectMembers.projectId, projects.id),
                )
                .where(
                  and(
                    eq(projectMembers.userId, operation.userId),
                    eq(projectMembers.role, "owner"),
                  ),
                )
                .orderBy(projects.id)
                .limit(1),
            )
            if (project) {
              const preview = yield* previewErasure(
                operation.userId,
                project.id,
                { kind: "project" },
              ).pipe(
                Effect.provideService(
                  Database,
                  tx as unknown as FlowmarkDatabase,
                ),
              )
              yield* confirmErasure(
                operation.userId,
                project.id,
                preview.id,
                project.name,
              ).pipe(
                Effect.provideService(
                  Database,
                  tx as unknown as FlowmarkDatabase,
                ),
              )
              const [updated] = yield* lifecycleQuery(() =>
                tx
                  .update(accountLifecycleOperations)
                  .set({
                    childProjectId: project.id,
                    childOperationId: preview.id,
                    failureCode: null,
                  })
                  .where(eq(accountLifecycleOperations.id, operationId))
                  .returning(),
              )
              return updated
            }
          }
          const batches = authErasureBatches(operation.userId, operationId)
          if (operation.phase < 0 || operation.phase > batches.length + 1) {
            return yield* new AccountLifecycleRejected({
              reason: "Unavailable",
            })
          }
          const batch = Array.get(batches, operation.phase - 1)
          const affected = yield* Option.match(batch, {
            onNone: () => Effect.succeed([]),
            onSome: (query) => lifecycleQuery(() => tx.execute(query)),
          })
          const done = operation.phase === batches.length + 1
          if (done) {
            const deleted = yield* lifecycleQuery(() =>
              tx
                .delete(user)
                .where(
                  and(
                    eq(user.id, operation.userId),
                    eq(user.lifecycleOperationId, operationId),
                  ),
                )
                .returning({ id: user.id }),
            )
            if (deleted.length !== 1) {
              return yield* new AccountLifecycleRejected({
                reason: "Unavailable",
              })
            }
          }
          const [updated] = yield* lifecycleQuery(() =>
            tx
              .update(accountLifecycleOperations)
              .set({
                phase: affected.length ? operation.phase : operation.phase + 1,
                failureCode: null,
                ...(done
                  ? {
                      state: "live_data_deleted",
                      completedAt: new Date(),
                      expiresAt: new Date(Date.now() + 30 * 86400_000),
                    }
                  : {}),
              })
              .where(eq(accountLifecycleOperations.id, operationId))
              .returning(),
          )
          return updated
        }),
    ).pipe(
      lifecycleDeadline,
      Effect.tapErrorTag("DatabaseError", () =>
        lifecycleQuery(() =>
          db
            .update(accountLifecycleOperations)
            .set({ failureCode: "BatchFailed" })
            .where(
              and(
                eq(accountLifecycleOperations.id, operationId),
                eq(
                  accountLifecycleOperations.capabilityHash,
                  hashApiKey(capability),
                ),
                eq(accountLifecycleOperations.state, "purging"),
              ),
            ),
        ),
      ),
    )
  },
)
