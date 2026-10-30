import { and, eq } from "drizzle-orm"
import { Effect } from "effect"
import type {
  WorkflowError,
  WorkflowFailure,
  WorkflowProperties,
  WorkflowResult,
} from "@flowmarkdev/core"
import {
  workflowEvents,
  workflowRuns,
  workflows,
} from "../../../schema/index.js"
import { Database } from "../../database.js"
import { DatabaseOperation } from "../../database-operation.js"
import { runQuery } from "../../run-query.js"

export type RunTimelineEvent = {
  id: string
  type: string
  step: string | null
  operationId: string | null
  operationName: string | null
  durationMs: number | null
  completed: number | null
  total: number | null
  unit: string | null
  reason: string | null
  properties: WorkflowProperties | null
  error: WorkflowError | WorkflowFailure | null
  outcome?: string | null
  result: WorkflowResult | null
  timestamp: string
  receivedAt: string
  workflow: string
  externalId: string
  environment: string | null
  release: string | null
  correlationId: string | null
  parentRunId: string | null
}

export const getRunTimeline = Effect.fn("getRunTimeline")(function* (
  projectId: string,
  runId: string,
) {
  const db = yield* Database
  const rows = yield* runQuery(DatabaseOperation.ReadRun, () =>
    db
      .select({
        id: workflowEvents.eventId,
        type: workflowEvents.type,
        step: workflowEvents.step,
        operationId: workflowEvents.operationId,
        operationName: workflowEvents.operationName,
        durationMs: workflowEvents.durationMs,
        completed: workflowEvents.progressCompleted,
        total: workflowEvents.progressTotal,
        unit: workflowEvents.progressUnit,
        reason: workflowEvents.reason,
        properties: workflowEvents.properties,
        error: workflowEvents.error,
        result: workflowEvents.result,
        outcome: workflowEvents.outcome,
        timestamp: workflowEvents.occurredAt,
        receivedAt: workflowEvents.createdAt,
        workflow: workflows.name,
        externalId: workflowRuns.externalId,
        environment: workflowRuns.environment,
        release: workflowRuns.release,
        correlationId: workflowRuns.correlationId,
        parentRunId: workflowRuns.parentRunId,
      })
      .from(workflowEvents)
      .innerJoin(workflowRuns, eq(workflowEvents.runId, workflowRuns.id))
      .innerJoin(workflows, eq(workflowRuns.workflowId, workflows.id))
      .where(
        and(eq(workflows.projectId, projectId), eq(workflowRuns.id, runId)),
      )
      .orderBy(workflowEvents.occurredAt, workflowEvents.createdAt),
  )
  return rows.map((row) => ({
    ...row,
    timestamp: row.timestamp.toISOString(),
    receivedAt: row.receivedAt.toISOString(),
    properties: row.properties ?? null,
    error: row.error ?? null,
    result: row.result ?? null,
    environment: row.environment ?? null,
    release: row.release ?? null,
    correlationId: row.correlationId ?? null,
    parentRunId: row.parentRunId ?? null,
  }))
})
