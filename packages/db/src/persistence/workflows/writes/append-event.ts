import { and, eq, sql, type SQL } from "drizzle-orm"
import { Effect } from "effect"
import type {
  WorkflowEvent,
  WorkflowProperties,
  WorkflowResult,
} from "@flowmarkdev/core"
import {
  workflowEvents,
  workflowRuns,
  workflows,
  type StoredWorkflowError,
} from "../../../schema/index.js"
import { Database, MissingRunError } from "../../database.js"
import { DatabaseOperation } from "../../database-operation.js"
import { runQuery } from "../../run-query.js"
import {
  eventError,
  eventFailure,
  eventProperties,
  eventResult,
  isTerminalError,
} from "./event-fields.js"
import { ignoreContinuedEvent, runTerminal } from "./continue-run.js"

const runUpdates = (
  event: WorkflowEvent,
  error: StoredWorkflowError | null,
  result: WorkflowResult | undefined,
) => {
  const changes: {
    properties?: WorkflowProperties | null | SQL
    error?: StoredWorkflowError
    outcome?: string | null
    result?: WorkflowResult
    environment?: string | null
    release?: string | null
  } = {}
  if (event.type === "properties") {
    changes.properties = sql`coalesce(${workflowRuns.properties}, '{}'::jsonb) || ${JSON.stringify(event.properties)}::jsonb`
  } else if (event.type === "started") {
    changes.properties = event.properties ?? null
    changes.environment = event.environment ?? null
    changes.release = event.release ?? null
  }
  if (error !== null && isTerminalError(event)) {
    changes.error = error
  }
  if (
    (event.type === "completed" || event.type === "failed") &&
    result !== undefined
  ) {
    changes.result = result
  }
  if (event.type === "completed" || event.type === "failed") {
    changes.outcome = event.outcome ?? null
  }
  return changes
}

export const appendEvent = Effect.fn("appendEvent")(function* (
  projectId: string,
  eventId: string,
  event: WorkflowEvent,
) {
  const db = yield* Database
  const accepted = yield* runQuery(DatabaseOperation.AppendEvent, () =>
    // Drizzle owns the transaction lifetime; bridge at its Promise callback boundary.
    db.transaction((tx) =>
      Effect.runPromise(
        Effect.gen(function* () {
          // Reserve envelope identity before creating rows; a rejected start leaves no phantom run.
          yield* runQuery(DatabaseOperation.AppendEvent, () =>
            tx.execute(
              sql`select pg_advisory_xact_lock(hashtextextended(${eventId}::text, 0))`,
            ),
          )
          const [existing] = yield* runQuery(
            DatabaseOperation.AppendEvent,
            () =>
              tx
                .select({
                  projectId: workflows.projectId,
                  workflow: workflows.name,
                  externalId: workflowRuns.externalId,
                })
                .from(workflowEvents)
                .innerJoin(
                  workflowRuns,
                  eq(workflowEvents.runId, workflowRuns.id),
                )
                .innerJoin(workflows, eq(workflowRuns.workflowId, workflows.id))
                .where(eq(workflowEvents.eventId, eventId)),
          )
          if (existing) {
            return existing.projectId === projectId &&
              existing.workflow === event.workflow &&
              existing.externalId === event.runId
              ? ("duplicate" as const)
              : ("conflict" as const)
          }
          yield* runQuery(DatabaseOperation.AppendEvent, () =>
            tx
              .insert(workflows)
              .values({ projectId, name: event.workflow })
              .onConflictDoNothing({
                target: [workflows.projectId, workflows.name],
              }),
          )
          const [definition] = yield* runQuery(
            DatabaseOperation.AppendEvent,
            () =>
              tx
                .select()
                .from(workflows)
                .where(
                  and(
                    eq(workflows.projectId, projectId),
                    eq(workflows.name, event.workflow),
                  ),
                ),
          )
          if (event.type === "started") {
            yield* runQuery(DatabaseOperation.AppendEvent, () =>
              tx
                .insert(workflowRuns)
                .values({
                  workflowId: definition.id,
                  externalId: event.runId,
                  startedAt: new Date(event.timestamp),
                  correlationId: event.correlationId ?? null,
                  parentRunId: event.parentRunId ?? null,
                })
                .onConflictDoNothing({
                  target: [workflowRuns.workflowId, workflowRuns.externalId],
                }),
            )
          }
          const [run] = yield* runQuery(DatabaseOperation.AppendEvent, () =>
            tx
              .select()
              .from(workflowRuns)
              .where(
                and(
                  eq(workflowRuns.workflowId, definition.id),
                  eq(workflowRuns.externalId, event.runId),
                ),
              )
              .for("update"),
          )
          if (!run) {
            return "missing" as const
          }
          const recorded = yield* runQuery(DatabaseOperation.AppendEvent, () =>
            tx
              .select({
                type: workflowEvents.type,
                eventId: workflowEvents.eventId,
              })
              .from(workflowEvents)
              .where(eq(workflowEvents.runId, run.id)),
          )
          if (recorded.some((row) => row.eventId === eventId)) {
            return "duplicate" as const
          }
          const types = new Set(recorded.map((row) => row.type))
          if (event.type === "started" && types.has("started")) {
            return "ignored" as const
          }
          if (ignoreContinuedEvent(runTerminal(types))) {
            return event.type === "completed" || event.type === "failed"
              ? ("conflict" as const)
              : ("ignored" as const)
          }
          const failure = eventFailure(event)
          const error = eventError(event, failure)
          const properties = eventProperties(event)
          const result = eventResult(event)
          const [inserted] = yield* runQuery(
            DatabaseOperation.AppendEvent,
            () =>
              tx
                .insert(workflowEvents)
                .values({
                  eventId,
                  runId: run.id,
                  type: event.type,
                  occurredAt: new Date(event.timestamp),
                  step: event.type === "step" ? event.step : null,
                  operationId:
                    "operationId" in event ? event.operationId : null,
                  operationName:
                    "operationName" in event ? event.operationName : null,
                  durationMs: "durationMs" in event ? event.durationMs : null,
                  progressCompleted:
                    event.type === "progress" ? event.completed : null,
                  progressTotal:
                    event.type === "progress" ? (event.total ?? null) : null,
                  progressUnit:
                    event.type === "progress" ? (event.unit ?? null) : null,
                  reason: event.type === "failed" ? event.reason : null,
                  properties: properties ?? null,
                  error,
                  result: result ?? null,
                  outcome: "outcome" in event ? (event.outcome ?? null) : null,
                })
                .onConflictDoNothing({ target: workflowEvents.eventId })
                .returning({ id: workflowEvents.id }),
          )
          if (!inserted) {
            return "conflict" as const
          }
          const changes = runUpdates(event, error, result)
          if (Object.keys(changes).length > 0) {
            yield* runQuery(DatabaseOperation.AppendEvent, () =>
              tx
                .update(workflowRuns)
                .set(changes)
                .where(eq(workflowRuns.id, run.id)),
            )
          }
          return "recorded" as const
        }),
      ),
    ),
  )
  if (accepted === "missing") {
    return yield* Effect.fail(new MissingRunError({ runId: event.runId }))
  }
  return accepted
})
