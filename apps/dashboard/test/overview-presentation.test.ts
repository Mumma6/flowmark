import { describe, expect, it } from "vitest"
import { overviewMetrics, windowLabel } from "../app/overview-presentation"

const current = {
  startedAfter: "2026-10-23T00:00:00.000Z",
  startedBefore: "2026-10-30T00:00:00.000Z",
  totalRuns: 10,
  finishedRuns: 8,
  completedRuns: 6,
  failedRuns: 2,
  successRate: 75,
  medianDurationMs: 400,
  p95DurationMs: 1250,
}
const previous = {
  ...current,
  totalRuns: 8,
  successRate: 60,
  p95DurationMs: 1000,
}

describe("Overview metric populations", () => {
  it("uses the window percentile and finished-run completion rate without recomputing either", () => {
    const metrics = overviewMetrics({ current, previous })
    expect(metrics.map((metric) => metric.value)).toEqual([
      "10",
      "75%",
      "2",
      "1.25 s",
    ])
    expect(metrics[1]?.change).toBe("+15 pp vs previous 7 days")
    expect(metrics[3]?.change).toBe("+250 ms vs previous 7 days")
  })

  it("does not invent a comparison against an empty prior population", () => {
    const metrics = overviewMetrics({
      current,
      previous: {
        ...previous,
        totalRuns: 0,
        successRate: null,
        p95DurationMs: null,
      },
    })
    expect(metrics.every((metric) => metric.change === undefined)).toBe(true)
  })

  it("distinguishes unreported durations and unfinished outcomes from zero", () => {
    const metrics = overviewMetrics({
      current: { ...current, successRate: null, p95DurationMs: null },
      previous,
    })
    expect(metrics[1]?.value).toBe("—")
    expect(metrics[3]?.value).toBe("—")
    expect(metrics[1]?.change).toBeUndefined()
    expect(
      overviewMetrics({
        current: { ...current, p95DurationMs: 0 },
        previous,
      })[3]?.value,
    ).toBe("0 ms")
  })

  it("labels half-open UTC windows with the actual last included calendar day", () => {
    expect(windowLabel(current)).toBe("2026-10-23 – 2026-10-29")
    expect(
      windowLabel({
        startedAfter: "2026-12-26T00:00:00.000Z",
        startedBefore: "2027-01-02T00:00:00.000Z",
      }),
    ).toBe("2026-12-26 – 2027-01-01")
  })
})
