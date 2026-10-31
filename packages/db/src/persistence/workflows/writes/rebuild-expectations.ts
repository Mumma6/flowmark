import { and, eq } from "drizzle-orm"
import { Effect } from "effect"
import { EXPECTATION_LIMIT } from "@flowmarkdev/core"
import {
  workflowEvents,
  workflowExpectations,
  workflowRuns,
  workflows,
} from "../../../schema/index.js"
import { Database, DatabaseError } from "../../database.js"
import { DatabaseOperation } from "../../database-operation.js"
import { runQuery } from "../../run-query.js"

/** Rebuild derived columns from original canonical receipts; retain the aggregate ownership anchor. */
export const rebuildExpectations = Effect.fn("rebuildExpectations")(function* (
  projectId: string,
  runId: string,
) {
  const db = yield* Database
  return yield* runQuery(DatabaseOperation.RebuildExpectations, () =>
    db.transaction((tx) =>
      Effect.runPromise(
        Effect.gen(function* () {
          const [run] = yield* runQuery(
            DatabaseOperation.RebuildExpectations,
            () =>
              tx
                .select({ id: workflowRuns.id })
                .from(workflowRuns)
                .innerJoin(workflows, eq(workflows.id, workflowRuns.workflowId))
                .where(
                  and(
                    eq(workflows.projectId, projectId),
                    eq(workflowRuns.id, runId),
                  ),
                )
                .for("update"),
          )
          if (!run) {
            return 0
          }
          const facts = yield* runQuery(
            DatabaseOperation.RebuildExpectations,
            () =>
              tx
                .select({
                  id: workflowEvents.id,
                  ownerId: workflowEvents.expectationOwnerId,
                  effective: workflowEvents.expectationEffective,
                  event: workflowEvents.expectation,
                  observedAt: workflowEvents.expectationObservedAt,
                })
                .from(workflowEvents)
                .where(eq(workflowEvents.runId, runId))
                .orderBy(workflowEvents.receiptOrder),
          )
          const records = new Map<
            string,
            typeof workflowExpectations.$inferInsert
          >()
          for (const fact of facts) {
            if (!fact.effective) {
              continue
            }
            const event = fact.event
            if (!event || !fact.observedAt || !fact.ownerId) {
              return yield* new DatabaseError({
                operation: DatabaseOperation.RebuildExpectations,
                cause:
                  "Canonical expectation evidence unavailable; cannot rebuild its state.",
              })
            }
            const record: typeof workflowExpectations.$inferInsert =
              records.get(event.expectationId) ?? {
                id: fact.ownerId,
                runId,
                expectationId: event.expectationId,
              }
            if (
              event.type === "expectation_declared" &&
              !record.declarationEventId
            ) {
              record.declarationEventId = fact.id
              record.declaredAt = fact.observedAt
              record.deadlineAt = new Date(
                fact.observedAt.getTime() + event.withinMs,
              )
            } else if (
              event.type !== "expectation_declared" &&
              !record.settlementEventId
            ) {
              record.settlementEventId = fact.id
              record.settledAt = fact.observedAt
              record.settlementType = event.type
            }
            records.set(event.expectationId, record)
          }
          if (records.size > EXPECTATION_LIMIT) {
            return yield* new DatabaseError({
              operation: DatabaseOperation.RebuildExpectations,
              cause: "Expectation identity limit exceeded.",
            })
          }
          for (const record of records.values()) {
            yield* runQuery(DatabaseOperation.RebuildExpectations, () =>
              tx
                .update(workflowExpectations)
                .set({
                  declarationEventId: record.declarationEventId ?? null,
                  settlementEventId: record.settlementEventId ?? null,
                  declaredAt: record.declaredAt ?? null,
                  deadlineAt: record.deadlineAt ?? null,
                  settledAt: record.settledAt ?? null,
                  settlementType: record.settlementType ?? null,
                })
                .where(
                  and(
                    eq(workflowExpectations.id, record.id!),
                    eq(workflowExpectations.runId, runId),
                  ),
                ),
            )
          }
          return records.size
        }),
      ),
    ),
  )
})
