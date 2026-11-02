import type { RunEvent } from "../../lib/api/types"

export function eventLabel(event: RunEvent) {
  switch (event.type) {
    case "expectation_declared":
      return `Expected · ${event.expectation?.type === "expectation_declared" ? event.expectation.name : "Confirmation"}`
    case "expectation_resolved":
      return "Expectation resolution reported"
    case "expectation_cancelled":
      return "Expectation cancellation reported"
    case "started":
      return "Run started"
    case "step":
      return event.step ?? "Checkpoint"
    case "properties":
      return "Context updated"
    case "error":
      return event.error && "handled" in event.error && event.error.handled
        ? "Handled error"
        : "Error observed"
    case "report":
      return "Business snapshot reported (non-final)"
    case "progress":
      return "Progress reported"
    case "completed":
      return "Run completed"
    case "failed":
      return "Run failed"
    case "operation_started":
      return `Started · ${event.operationName ?? "Operation"}`
    case "operation_completed":
      return `Completed · ${event.operationName ?? "Operation"}`
    case "operation_failed":
      return `Failed · ${event.operationName ?? "Operation"}`
    default:
      return event.type
  }
}
