import { describe, expect, it } from "vitest"
import { Effect } from "effect"
import { EvidenceEngine, EvidenceEngineError } from "@flowmark/evidence-engine"
import { calculateRunComparison } from "../../src/features/workflows/use-cases/calculate-run-comparison.js"
import type { StoredRun } from "../../src/features/workflows/types.js"

const run: StoredRun = {
  id: "current",
  externalId: "external",
  workflow: "import",
  startedAt: "2026-01-01T00:00:00Z",
  status: "Completed",
  durationMs: 100,
  step: null,
  result: null,
  correlationId: null,
  parentRunId: null,
}
const event = (
  operationId: string,
  durationMs: number,
  type = "operation_completed",
) => ({
  type,
  operationId,
  durationMs,
  operationName: "page",
  timestamp: "2026-01-01T00:00:00Z",
})
describe("application comparison calculation", () => {
  it("keeps legacy fields, occurrence medians, peer denominators and recorded totals distinct", async () => {
    const result = await Effect.runPromise(
      calculateRunComparison({
        current: run,
        peers: [
          { ...run, id: "p1", durationMs: 20 },
          { ...run, id: "p2", status: "Failed", durationMs: 40 },
          { ...run, id: "p3", status: "Running", durationMs: null },
        ],
        currentOperations: [
          event("a", 10),
          event("b", 20, "operation_failed"),
          { ...event("c", 99, "operation_started"), durationMs: null },
        ],
        peerOperations: [
          { runId: "p1", events: [event("a", 2), event("b", 8)] },
          { runId: "p2", events: [event("a", 12)] },
          { runId: "p3", events: [] },
        ],
      }).pipe(Effect.provide(EvidenceEngine.layer)),
    )
    expect(result.peerSuccessRate).toBe(50)
    expect(result.peerMedianDurationMs).toBe(30)
    expect(result.peerP95DurationMs).toBe(39)
    expect(result.operations).toEqual([
      {
        name: "page",
        currentDurationMs: 20,
        currentOccurrenceCount: 3,
        currentOpenCount: 1,
        currentFailedCount: 1,
        currentMedianOccurrenceDurationMs: 15,
        currentTotalRecordedDurationMs: 30,
        currentStatus: "failed",
        peerMedianDurationMs: 10,
        peerMedianOccurrenceDurationMs: 8.5,
        peerMedianTotalRecordedDurationMs: 11,
        peerOpenRunCount: 0,
        peerFailedRunCount: 0,
        peerPresentCount: 2,
        peerRunIds: ["p1", "p2"],
      },
    ])
  })
  it("returns the unchanged missing-run response without invoking WASM", async () => {
    const result = await Effect.runPromise(
      calculateRunComparison({
        current: null,
        peers: [],
        currentOperations: [],
        peerOperations: [],
      }).pipe(
        Effect.provideService(
          EvidenceEngine,
          EvidenceEngine.of({
            summarizeOperations: () => Effect.die("must not load"),
            percentile: () => Effect.die("must not load"),
          }),
        ),
      ),
    )
    expect(result).toEqual({
      current: null,
      peers: [],
      peerSuccessRate: null,
      peerMedianDurationMs: null,
      peerP95DurationMs: null,
      operations: [],
    })
  })
  it("propagates engine failures without producing an empty successful comparison", async () => {
    const failure = new EvidenceEngineError({
      operation: "summarizeOperations",
      stage: "initialization",
      cause: "missing asset",
    })
    const result = await Effect.runPromise(
      Effect.result(
        calculateRunComparison({
          current: run,
          peers: [],
          currentOperations: [],
          peerOperations: [],
        }),
      ).pipe(
        Effect.provideService(
          EvidenceEngine,
          EvidenceEngine.of({
            summarizeOperations: () => Effect.fail(failure),
            percentile: () => Effect.succeed(null),
          }),
        ),
      ),
    )
    expect(result).toMatchObject({ _tag: "Failure", failure })
  })
})
