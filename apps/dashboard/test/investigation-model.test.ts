import { Option } from "effect"
import { expect, it } from "vitest"
import { buildInvestigation } from "../features/runs/investigation/investigation-model"
import type { RunEvent } from "../features/platform/api-types"
import {
  durationDelta,
  terminalEvidence,
} from "../features/runs/models/run-state"
import { investigationHandoff } from "../features/runs/handoff/investigation-handoff"

const event = (
  type: RunEvent["type"],
  extra: Partial<RunEvent> = {},
): RunEvent =>
  ({
    id: type,
    type,
    workflow: "orders.import",
    externalId: "execution-1",
    timestamp: "2026-10-01T00:00:00Z",
    ...extra,
  }) as RunEvent
it("has no investigation for an empty event population", () => {
  expect(Option.isNone(buildInvestigation([]))).toBe(true)
})
it("preserves failure precedence, partial results, latest progress and shallow context amendments", () => {
  const events = [
    event("started", {
      properties: { definitionRevision: "v1", region: "old" },
    }),
    event("properties", { properties: { region: "new" } }),
    event("progress", { completed: 0 }),
    event("completed", { result: { count: 4 } }),
    event("failed", { result: { count: 2 } }),
  ]
  const model = Option.getOrThrow(buildInvestigation(events))
  expect(model.state).toBe("Failed")
  expect(model.reportedResult).toEqual({ count: 2 })
  expect(model.context.get("region")).toBe("new")
  expect(model.progress?.completed).toBe(0)
  expect(model.snapshot?.status).toBe("Failed")
})
it("does not turn an observed handled error or absent terminal telemetry into failure", () => {
  expect(
    terminalEvidence([
      event("started"),
      event("error", { error: { code: "OBSERVED", handled: true } }),
    ]).state,
  ).toBe("Running")
  expect(durationDelta(null, 10)).toBeNull()
  expect(durationDelta(0, 0)).toBe(0)
})

it("hands off missing final telemetry without claiming the run is active or failed", () => {
  const summary = Option.getOrThrow(
    investigationHandoff(
      [
        event("started"),
        event("error", { error: { code: "OBSERVED", handled: true } }),
      ],
      "/runs/recorded-run",
    ),
  )
  expect(summary).toContain("Execution status: No final outcome recorded")
  expect(summary).toContain("Failure code: Not recorded")
  expect(summary).toContain("Reported outcome: Not recorded")
  expect(summary).toContain("Evidence: /runs/recorded-run")
  expect(Option.isNone(investigationHandoff([], "/runs/missing"))).toBe(true)
})

it("hands off failure evidence with precedence over completion and retains identifiers", () => {
  const summary = Option.getOrThrow(
    investigationHandoff(
      [
        event("started", {
          correlationId: "reference-1",
          environment: "staging",
        }),
        event("completed", { outcome: "accepted" }),
        event("failed", {
          outcome: "partial",
          error: { code: "UPSTREAM_TIMEOUT", message: "No response" },
        }),
      ],
      "/runs/recorded-run",
    ),
  )
  expect(summary).toContain("Execution status: Failed")
  expect(summary).toContain("Failure code: UPSTREAM_TIMEOUT")
  expect(summary).toContain("Reported outcome: partial")
  expect(summary).toContain("Correlation ID: reference-1")
  expect(summary).toContain("root cause are not verified")
})
