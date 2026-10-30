import type { WorkflowEvent } from "@flowmarkdev/core"
import type {
  WorkflowDoneOptions,
  WorkflowFailOptions,
  WorkflowRunOptions,
} from "../types/index.js"

/** Event-specific data; identity and timestamp belong to the run's recorder. */
export type WorkflowEventData<
  Type extends WorkflowEvent["type"] = WorkflowEvent["type"],
> = {
  [Key in Type]: Omit<
    Extract<WorkflowEvent, { type: Key }>,
    "workflow" | "runId" | "timestamp"
  >
}[Type]

export function startedEvent(
  options: WorkflowRunOptions,
): WorkflowEventData<"started"> {
  return {
    type: "started",
    ...(options.properties === undefined
      ? {}
      : { properties: options.properties }),
    ...(options.environment === undefined
      ? {}
      : { environment: options.environment }),
    ...(options.release === undefined ? {} : { release: options.release }),
    ...(options.correlationId === undefined
      ? {}
      : { correlationId: options.correlationId }),
    ...(options.parentRunId === undefined
      ? {}
      : { parentRunId: options.parentRunId }),
  }
}

export function completedEvent(
  options?: WorkflowDoneOptions,
): WorkflowEventData<"completed"> {
  return {
    type: "completed",
    ...(options?.outcome === undefined ? {} : { outcome: options.outcome }),
    ...(options?.result === undefined ? {} : { result: options.result }),
  }
}

export function failedEvent(
  options: WorkflowFailOptions,
): WorkflowEventData<"failed"> {
  const { result, outcome, ...failure } = options
  return {
    type: "failed",
    failure,
    ...(outcome === undefined ? {} : { outcome }),
    ...(result === undefined ? {} : { result }),
  }
}
