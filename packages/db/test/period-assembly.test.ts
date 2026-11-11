import assert from "node:assert/strict"
import { test } from "node:test"
import {
  assembleWorkflowPeriods,
  assembleFailureGroups,
  type WorkflowPeriodRow,
} from "../src/persistence/workflows/queries/assemble-period-report.js"

const row = (
  name: string,
  period: "current" | "previous",
  totalRuns: number,
): WorkflowPeriodRow =>
  Object.freeze({
    name,
    period,
    totalRuns,
    finishedRuns: 0,
    completedRuns: 0,
    failedRuns: 0,
    successRate: null,
    medianDurationMs: null,
    p95DurationMs: null,
  })

test("period assembly groups frozen unordered rows, keeps last duplicate and preserves null statistics", () => {
  const rows = Object.freeze([
    row("B", "previous", 5),
    row("A", "current", 3),
    row("B", "current", 2),
    row("B", "current", 6),
  ])
  const report = assembleWorkflowPeriods(rows)
  assert.deepEqual(
    report.map((item) => [
      item.name,
      item.current.totalRuns,
      item.previous.totalRuns,
    ]),
    [
      ["B", 6, 5],
      ["A", 3, 0],
    ],
  )
  assert.equal(report[1]?.previous.medianDurationMs, null)
  assert.equal(report[1]?.previous.successRate, null)
  assert.deepEqual(assembleWorkflowPeriods([]), [])
  assert.equal(rows[2]?.totalRuns, 2)
})

test("failure groups retain existing coverage bounds and supplied run-reference filtering", () => {
  const rows = Object.freeze(
    Array.from({ length: 51 }, (_, i) =>
      Object.freeze({
        workflow: "w",
        code: String(i),
        currentCount: 2,
        previousCount: 1,
        lastStartedAt: null,
        runIds: ["1", null, "2", "3", "4", "5", "6"],
      }),
    ),
  )
  const report = assembleFailureGroups(rows)
  assert.equal(report.truncated, true)
  assert.equal(report.groups.length, 50)
  assert.deepEqual(report.groups[0]?.runIds, ["1", "2", "3", "4", "5"])
  assert.equal(report.groups[0]?.countDelta, 1)
})
