import assert from "node:assert/strict"
import { test } from "node:test"
import {
  assembleFailureGroups,
  assembleWorkflowPeriods,
} from "../../src/persistence/workflows/queries/assemble-period-report.js"

const counts = {
  totalRuns: 0,
  finishedRuns: 0,
  completedRuns: 0,
  failedRuns: 0,
  successRate: null,
  medianDurationMs: null,
  p95DurationMs: null,
}

test("workflow periods keep a missing window at zero instead of copying the other window", () => {
  const [billing, imports] = assembleWorkflowPeriods([
    {
      name: "billing.charge",
      period: "current",
      ...counts,
      totalRuns: 4,
      finishedRuns: 4,
      completedRuns: 3,
      failedRuns: 1,
      successRate: 75,
      medianDurationMs: 10,
      p95DurationMs: 40,
    },
    {
      name: "imports.customers",
      period: "previous",
      ...counts,
      totalRuns: 9,
      finishedRuns: 9,
      completedRuns: 9,
      failedRuns: 0,
      successRate: 100,
      medianDurationMs: 20,
      p95DurationMs: 30,
    },
  ])
  assert.equal(billing?.name, "billing.charge")
  assert.equal(billing?.current.totalRuns, 4)
  assert.equal(billing?.previous.totalRuns, 0)
  assert.equal(billing?.previous.successRate, null)
  assert.equal(imports?.current.totalRuns, 0)
  assert.equal(imports?.previous.failedRuns, 0)
  assert.equal(imports?.previous.successRate, 100)
})

test("failure groups are derived counts with a bounded sample, not tracked issues", () => {
  const assembled = assembleFailureGroups([
    {
      workflow: "imports.customers",
      code: "rejected",
      currentCount: 6,
      previousCount: 1,
      lastStartedAt: new Date("2026-10-27T12:00:00.000Z"),
      runIds: ["run-1", "run-2", 3, "run-3", "run-4", "run-5", "run-6"],
    },
    {
      workflow: "imports.customers",
      code: "",
      currentCount: 1,
      previousCount: 0,
      lastStartedAt: null,
      runIds: null,
    },
  ])
  assert.equal(assembled.truncated, false)
  assert.equal(assembled.groups[0]?.countDelta, 5)
  assert.equal(assembled.groups[0]?.lastStartedAt, "2026-10-27T12:00:00.000Z")
  assert.deepEqual(assembled.groups[0]?.runIds, [
    "run-1",
    "run-2",
    "run-3",
    "run-4",
    "run-5",
  ])
  assert.equal(assembled.groups[1]?.code, "")
  assert.deepEqual(assembled.groups[1]?.runIds, [])
})

test("failure group assembly reports when the current window has more than 50 groups", () => {
  const rows = Array.from({ length: 51 }, (_, index) => ({
    workflow: "imports.customers",
    code: `code-${index}`,
    currentCount: 51 - index,
    previousCount: 0,
    lastStartedAt: null,
    runIds: [`run-${index}`],
  }))
  const assembled = assembleFailureGroups(rows)
  assert.equal(assembled.truncated, true)
  assert.equal(assembled.groups.length, 50)
  assert.equal(assembled.groups[0]?.code, "code-0")
  assert.equal(assembled.groups.at(-1)?.code, "code-49")
})
