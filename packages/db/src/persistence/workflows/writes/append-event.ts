import { and, eq, sql, type SQL } from "drizzle-orm"
import { Effect } from "effect"
import type {
  WorkflowEvent,
  WorkflowProperties,
  WorkflowResult,
} from "@flowmark/core"
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

const runUpdates = (
  event: WorkflowEvent,
  error: StoredWorkflowError | null,
  result: WorkflowResult | undefined,
) => {
  const changes: {
    properties?: WorkflowProperties | null | SQL
    error?: StoredWorkflowError
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
  if (event.type === "completed" && result !== undefined) {
    changes.result = result
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
    db.transaction(async (tx) => {
      await tx
        .insert(workflows)
        .values({ projectId, name: event.workflow })
        .onConflictDoNothing({
          target: [workflows.projectId, workflows.name],
        })
      const [definition] = await tx
        .select()
        .from(workflows)
        .where(
          and(
            eq(workflows.projectId, projectId),
            eq(workflows.name, event.workflow),
          ),
        )
      if (event.type === "started") {
        await tx
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
          })
      }
      const [run] = await tx
        .select()
        .from(workflowRuns)
        .where(
          and(
            eq(workflowRuns.workflowId, definition.id),
            eq(workflowRuns.externalId, event.runId),
          ),
        )
      if (!run) {
        return false
      }
      const failure = eventFailure(event)
      const error = eventError(event, failure)
      const properties = eventProperties(event)
      const result = eventResult(event)
      const [inserted] = await tx
        .insert(workflowEvents)
        .values({
          eventId,
          runId: run.id,
          type: event.type,
          occurredAt: new Date(event.timestamp),
          step: event.type === "step" ? event.step : null,
          operationId: "operationId" in event ? event.operationId : null,
          operationName: "operationName" in event ? event.operationName : null,
          durationMs: "durationMs" in event ? event.durationMs : null,
          progressCompleted: event.type === "progress" ? event.completed : null,
          progressTotal:
            event.type === "progress" ? (event.total ?? null) : null,
          progressUnit: event.type === "progress" ? (event.unit ?? null) : null,
          reason: event.type === "failed" ? event.reason : null,
          properties: properties ?? null,
          error,
          result: result ?? null,
        })
        .onConflictDoNothing({ target: workflowEvents.eventId })
        .returning({ id: workflowEvents.id })
      if (!inserted) {
        return true
      }
      const changes = runUpdates(event, error, result)
      if (Object.keys(changes).length > 0) {
        await tx
          .update(workflowRuns)
          .set(changes)
          .where(eq(workflowRuns.id, run.id))
      }
      return true
    }),
  )
  if (!accepted) {
    return yield* Effect.fail(new MissingRunError({ runId: event.runId }))
  }
})
