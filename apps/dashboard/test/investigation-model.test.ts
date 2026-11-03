import { Option } from "effect"
import { expect, it } from "vitest"
import { buildInvestigation } from "../features/runs/investigation-model"
import type { RunEvent } from "../features/platform/api-types"
import { durationDelta, terminalEvidence } from "../features/runs/run-state"

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
