import { describe, expect, it } from "vitest"
import {
  axisDuration,
  chartHeight,
  dailyDurationData,
  dailyVolumeData,
  failureCodeData,
  operationDurationData,
  shortLabel,
} from "../features/reporting/chart-model"
import type { Snapshot } from "../features/platform/api-types"

describe("reporting presentation projections", () => {
  it("preserves reported zero and missing duration instead of deriving cohort statistics", () => {
    const daily = Object.freeze([
      {
        date: "2026-11-01",
        count: 1,
        completed: 0,
        failed: 1,
        successRate: 0,
        medianDurationMs: null,
        p95DurationMs: 0,
      },
    ]) satisfies Readonly<Snapshot["daily"]>
    expect(dailyVolumeData(daily)).toEqual([
      { date: "2026-11-01", completed: 0, failed: 1, successRate: 0 },
    ])
    expect(dailyDurationData(daily)).toEqual([
      { date: "2026-11-01", median: null, p95: 0 },
    ])
  })
  it("bounds chart bars without sorting or mutating server evidence", () => {
    const operations = Object.freeze(
      Array.from({ length: 10 }, (_, i) =>
        Object.freeze({
          name: `operation-${i}`,
          workflow: "import",
          totalDurationMs: i,
          count: 1,
          failed: 0,
          medianDurationMs: i,
          p95DurationMs: i,
        }),
      ),
    ) satisfies Readonly<Snapshot["operations"]>
    expect(
      operationDurationData(operations).map((item) => item.duration),
    ).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
    expect(operations).toHaveLength(10)
    expect(failureCodeData([])).toEqual([])
    expect([0, 1, 2, 3, 4].map(chartHeight)).toEqual([
      "h-[140px]",
      "h-[140px]",
      "h-[200px]",
      "h-[200px]",
      "h-[240px]",
    ])
    expect(axisDuration(0)).toBe("0ms")
    expect(shortLabel("abcdefghijklmnopqrstuvwxyz")).toHaveLength(20)
  })
})
