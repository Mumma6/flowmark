import { Array, Schema } from "effect"
import {
  EventEnvelopeSchema,
  type WorkflowEvent,
  type WorkflowProperties,
  type WorkflowResult,
} from "@flowmarkdev/core"
import { DATASET, type WorkflowName } from "../scenarios/catalog.js"
import { uuid } from "./identity.js"

export type Envelope = typeof EventEnvelopeSchema.Type
export interface SyntheticRun {
  readonly workflow: WorkflowName
  readonly runId: string
  readonly events: readonly Envelope[]
}
export interface RunSpec {
  readonly workflow: WorkflowName
  readonly key: string
  readonly at: number
  readonly duration: number
  readonly properties: WorkflowProperties
  readonly result?: WorkflowResult
  readonly outcome?: string
  readonly failure?: string
  readonly incomplete?: boolean
  readonly retry?: boolean
  readonly parentRunId?: string
  readonly retryOf?: { readonly workflow: string; readonly runId: string }
  readonly correlationId: string
  readonly expectation?: "on-time" | "late" | "overdue" | "pending"
}

/** Uses the existing ingestion contract. This is fixture construction, not an SDK clock override. */
export const makeRun = (spec: RunSpec, configHash: string): SyntheticRun => {
  const runId = `${DATASET}:${spec.key}`
  const event = (offset: number, fields: object): WorkflowEvent =>
    ({
      workflow: spec.workflow,
      runId,
      timestamp: new Date(spec.at + offset).toISOString(),
      ...fields,
    }) as WorkflowEvent
  const operationId = uuid(`${runId}:operation:1`)
  const secondOperation = uuid(`${runId}:operation:2`)
  const operationName =
    spec.workflow === "appointment.book"
      ? "request-scheduling-provider"
      : `process-${spec.workflow}`
  const firstDuration = spec.retry
    ? Math.floor(spec.duration * 0.6)
    : spec.duration - 80
  const attempt = spec.retry
    ? { groupId: `${runId}:request`, number: 1 }
    : undefined
  const events: WorkflowEvent[] = [
    event(0, {
      type: "started",
      environment: "staging",
      release: "meridian-demo-v1",
      correlationId: spec.correlationId,
      parentRunId: spec.parentRunId,
      retryOf: spec.retryOf,
      properties: {
        ...spec.properties,
        synthetic: true,
        demoDataset: DATASET,
        demoConfig: configHash,
        definitionRevision: "meridian-v1",
      },
    }),
    event(10, { type: "step", step: "request-validated" }),
    event(20, { type: "progress", completed: 0, total: 100, unit: "percent" }),
    event(30, {
      type: "operation_started",
      operationId,
      operationName,
      attempt,
    }),
    event(30 + Math.floor(firstDuration / 2), {
      type: "report",
      result: spec.result
        ? {
            observed: "processing",
            ...Object.fromEntries(
              Object.entries(spec.result).filter(([key]) =>
                ["received", "requested", "checked"].includes(key),
              ),
            ),
          }
        : { observed: "processing" },
    }),
  ]
  const operationEnd = spec.incomplete
    ? []
    : [
        event(
          30 + firstDuration,
          spec.failure || spec.retry
            ? {
                type: "operation_failed",
                operationId,
                operationName,
                durationMs: firstDuration,
                attempt,
                failure: {
                  code: spec.failure ?? "SCHEDULER_TIMEOUT",
                  message:
                    "Synthetic external integration did not acknowledge the request.",
                  retryable: true,
                },
              }
            : {
                type: "operation_completed",
                operationId,
                operationName,
                durationMs: firstDuration,
              },
        ),
      ]
  const retries = spec.retry
    ? [
        event(firstDuration + 35, {
          type: "error",
          error: {
            code: "SCHEDULER_TIMEOUT",
            message: "Application elected to retry its request.",
            retryable: true,
            handled: true,
          },
        }),
        event(firstDuration + 40, {
          type: "operation_started",
          operationId: secondOperation,
          operationName,
          attempt: { groupId: `${runId}:request`, number: 2 },
        }),
        event(spec.duration - 20, {
          type: "operation_completed",
          operationId: secondOperation,
          operationName,
          durationMs: spec.duration - 20 - firstDuration - 40,
          attempt: { groupId: `${runId}:request`, number: 2 },
        }),
      ]
    : []
  const expectations = spec.expectation
    ? [
        event(spec.duration - 10, {
          type: "expectation_declared",
          expectationId: "external-ack",
          name: "external-confirmation",
          withinMs: 3600000,
        }),
      ]
    : []
  const terminal = spec.incomplete
    ? []
    : [
        event(spec.duration - 5, {
          type: "progress",
          completed: 100,
          total: 100,
          unit: "percent",
        }),
        event(
          spec.duration,
          spec.failure
            ? {
                type: "failed",
                failure: { code: spec.failure, retryable: true },
                result: spec.result,
                outcome: spec.outcome,
              }
            : { type: "completed", result: spec.result, outcome: spec.outcome },
        ),
      ]
  const settlement =
    spec.expectation === "on-time" || spec.expectation === "late"
      ? [
          event(
            spec.duration +
              (spec.expectation === "late" ? 3 * 3600000 : 15 * 60000),
            {
              type: "expectation_resolved",
              expectationId: "external-ack",
              outcome: "confirmed",
              result: { acknowledged: true },
            },
          ),
        ]
      : []
  return {
    workflow: spec.workflow,
    runId,
    events: Array.map(
      [
        ...events,
        ...operationEnd,
        ...retries,
        ...expectations,
        ...terminal,
        ...settlement,
      ],
      (item, index) =>
        Schema.decodeUnknownSync(EventEnvelopeSchema)({
          eventId: uuid(`${runId}:${index}`),
          event: item,
        }),
    ),
  }
}
