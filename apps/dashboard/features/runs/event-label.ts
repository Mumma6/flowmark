import { Match } from "effect"
import type { RunEvent } from "../platform/api-types"

export function eventLabel(event: RunEvent) {
  return Match.value(event.type).pipe(
    Match.when(
      "expectation_declared",
      () =>
        `Expected · ${event.expectation?.type === "expectation_declared" ? event.expectation.name : "Confirmation"}`,
    ),
    Match.when("expectation_resolved", () => "Expectation resolution reported"),
    Match.when(
      "expectation_cancelled",
      () => "Expectation cancellation reported",
    ),
    Match.when("started", () => "Run started"),
    Match.when("step", () => event.step ?? "Checkpoint"),
    Match.when("properties", () => "Context updated"),
    Match.when("error", () =>
      event.error && "handled" in event.error && event.error.handled
        ? "Handled error"
        : "Error observed",
    ),
    Match.when("report", () => "Business snapshot reported (non-final)"),
    Match.when("progress", () => "Progress reported"),
    Match.when("completed", () => "Run completed"),
    Match.when("failed", () => "Run failed"),
    Match.when(
      "operation_started",
      () => `Started · ${event.operationName ?? "Operation"}`,
    ),
    Match.when(
      "operation_completed",
      () => `Completed · ${event.operationName ?? "Operation"}`,
    ),
    Match.when(
      "operation_failed",
      () => `Failed · ${event.operationName ?? "Operation"}`,
    ),
    Match.orElse(() => event.type),
  )
}
