import assert from "node:assert/strict"
import { test } from "node:test"
import { operationSummaries } from "../../src/persistence/workflows/queries/get-run-comparison.js"

test("repeated operation names retain counts, open/failed presence and recorded work", () => {
  const events = [
    {
      type: "operation_started",
      operationId: "a",
      operationName: "page",
      durationMs: null,
      timestamp: "2026-01-01T00:00:00.000Z",
    },
    {
      type: "operation_completed",
      operationId: "a",
      operationName: "page",
      durationMs: 10,
      timestamp: "2026-01-01T00:00:00.010Z",
    },
    {
      type: "operation_started",
      operationId: "b",
      operationName: "page",
      durationMs: null,
      timestamp: "2026-01-01T00:00:00.000Z",
    },
    {
      type: "operation_failed",
      operationId: "b",
      operationName: "page",
      durationMs: 20,
      timestamp: "2026-01-01T00:00:00.020Z",
    },
    {
      type: "operation_started",
      operationId: "c",
      operationName: "page",
      durationMs: null,
      timestamp: "2026-01-01T00:00:00.000Z",
    },
  ]
  assert.deepEqual(operationSummaries(events), [
    {
      name: "page",
      occurrenceCount: 3,
      openCount: 1,
      failedCount: 1,
      medianDurationMs: 15,
      totalRecordedDurationMs: 30,
      durationMs: 20,
      status: "failed",
    },
  ])
})

test("terminal-only evidence remains present and late starts do not reopen it", () => {
  const terminal = {
    type: "operation_failed",
    operationId: "orphan",
    operationName: "page",
    durationMs: 20,
    timestamp: "2026-01-01T00:00:00.000Z",
  }
  const rows = operationSummaries([
    terminal,
    { ...terminal, type: "operation_started", durationMs: null },
  ])
  assert.equal(rows[0].occurrenceCount, 1)
  assert.equal(rows[0].failedCount, 1)
  assert.equal(rows[0].openCount, 0)
  assert.equal(rows[0].totalRecordedDurationMs, 20)
  assert.deepEqual(operationSummaries([]), [])
})
