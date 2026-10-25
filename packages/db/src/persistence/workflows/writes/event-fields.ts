import type { WorkflowEvent } from "@flowmark/core"
import type { StoredWorkflowError } from "../../../schema/index.js"

const shortReason = (reason: string) =>
  reason.length > 0 && reason.length <= 128

export const eventFailure = (
  event: WorkflowEvent,
): StoredWorkflowError | null => {
  if (event.type === "failed") {
    if (event.failure) {
      return event.failure
    }
    if (event.reason === undefined) {
      return null
    }
    return shortReason(event.reason)
      ? { code: event.reason }
      : { code: "failed", message: event.reason }
  }
  if (event.type === "operation_failed") {
    return event.failure
  }
  return null
}

export const eventProperties = (event: WorkflowEvent) =>
  event.type === "started" ||
  event.type === "step" ||
  event.type === "properties"
    ? event.properties
    : undefined

export const eventResult = (event: WorkflowEvent) =>
  event.type === "completed" ? event.result : undefined

export const eventError = (
  event: WorkflowEvent,
  failure: StoredWorkflowError | null,
) => (event.type === "error" ? event.error : failure)

export const isTerminalError = (event: WorkflowEvent) =>
  event.type === "error" || event.type === "failed"
