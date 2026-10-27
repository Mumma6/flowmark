import { afterEach, describe, expect, it, vi } from "vitest"
import { getRunDurationMs } from "../app/run-presentation"
import {
  filterRuns,
  formatDuration,
  groupBy,
  paginate,
  durationInRange,
  defaultIntelligenceQuery,
  percentChange,
  percentile,
  shareWidthClass,
  summarizeDays,
  weekOverWeek,
  workflowFamily,
  type DayInsight,
  type Run,
  type RunFilters,
} from "../app/dashboard-data"

afterEach(() => {
  vi.useRealTimers()
})

const filters: RunFilters = {
  search: "",
  status: "all",
  workflow: "all",
  namespace: "all",
  sort: "recent",
}
const runs: Run[] = Array.from({ length: 40 }, (_, index) => ({
  id: `run-${index}`,
  externalId: `external-${index}`,
  workflow:
    index % 3 === 0
      ? "browser.invoice.import"
      : index % 3 === 1
        ? "invoice.import"
        : "inventory.sync",
  status:
    index % 4 === 0 ? "Failed" : index % 4 === 1 ? "Running" : "Completed",
  startedAt: new Date(Date.UTC(2026, 9, 25, 0, index)).toISOString(),
  durationMs: index % 4 === 1 ? null : index * 100,
  step: "source-loaded",
  result: index % 4 >= 2 ? { imported: index } : null,
  correlationId: index === 5 ? "request-special" : null,
  parentRunId: null,
}))

describe("run explorer", () => {
  it("orders by newest first without mutating query data", () => {
    const original = runs.map((run) => run.id)
    expect(filterRuns(runs, filters)[0]?.id).toBe("run-39")
    expect(runs.map((run) => run.id)).toEqual(original)
  })

  it("combines workflow, status and namespace filters", () => {
    const result = filterRuns(runs, {
      ...filters,
      workflow: "invoice.import",
      status: "Completed",
      namespace: "server",
    })
    expect(result.length).toBeGreaterThan(0)
    expect(
      result.every(
        (run) =>
          run.workflow === "invoice.import" && run.status === "Completed",
      ),
    ).toBe(true)
    expect(
      filterRuns(runs, {
        ...filters,
        workflow: "invoice.import",
        namespace: "browser",
      }),
    ).toEqual([])
  })

  it("searches IDs, checkpoints and correlation without inventing context data", () => {
    expect(
      filterRuns(runs, { ...filters, search: " REQUEST-SPECIAL " }).map(
        (run) => run.id,
      ),
    ).toEqual(["run-5"])
    expect(
      filterRuns(runs, { ...filters, search: "source-loaded" }),
    ).toHaveLength(40)
    expect(filterRuns(runs, { ...filters, search: "does-not-exist" })).toEqual(
      [],
    )
  })

  it("sorts known durations before unreported values", () => {
    const sorted = filterRuns(runs, { ...filters, sort: "duration" })
    expect(sorted[0]?.durationMs).toBe(3900)
    expect(sorted.at(-1)?.durationMs).toBeNull()
  })
})

describe("bounded tables and grouping", () => {
  it("uses run timestamps, not operation durations, consistently with snapshot queries", () => {
    const started = { type: "started", timestamp: "2026-10-25T08:00:00.000Z" }
    const failed = { type: "failed", timestamp: "2026-10-25T08:00:00.064Z" }
    const completed = {
      type: "completed",
      timestamp: "2026-10-25T08:00:00.252Z",
    }
    expect(getRunDurationMs([started, failed])).toBe(64)
    expect(getRunDurationMs([completed, started, failed])).toBe(252)
    expect(getRunDurationMs([started])).toBeNull()
    expect(getRunDurationMs([failed])).toBeNull()
    expect(
      getRunDurationMs([
        started,
        { ...completed, timestamp: started.timestamp },
      ]),
    ).toBe(0)
  })

  it("paginates every match exactly once", () => {
    const pages = [1, 2, 3].flatMap((page) => paginate(runs, page, 15).items)
    expect(pages.map((run) => run.id)).toEqual(runs.map((run) => run.id))
    expect(new Set(pages.map((run) => run.id)).size).toBe(40)
    expect(paginate(runs, 1, 15).items).toHaveLength(15)
  })

  it("clamps a stale page after filtering and supports empty data", () => {
    expect(paginate(runs.slice(0, 2), 3, 15)).toMatchObject({
      page: 1,
      pages: 1,
      total: 2,
    })
    expect(paginate([], 8, 15)).toEqual({
      items: [],
      page: 1,
      pages: 1,
      total: 0,
    })
  })

  it("groups names without changing workflow identity", () => {
    expect(workflowFamily("browser.invoice.import")).toBe("invoice")
    expect(workflowFamily("invoice.import")).toBe("invoice")
    expect(workflowFamily("import")).toBe("Other")
    const groups = groupBy(runs, (run) => run.workflow)
    expect(groups).toHaveLength(3)
    expect(groups.flatMap(([, items]) => items)).toHaveLength(40)
    expect(
      groups.every(([name, items]) =>
        items.every((run) => run.workflow === name),
      ),
    ).toBe(true)
  })

  it("keeps a missing duration distinct from a zero-duration run", () => {
    expect(formatDuration(null)).toBe("Not reported")
    expect(formatDuration(0)).toBe("0 ms")
  })
})

describe("insight math", () => {
  it("computes median and p95 without inventing empty-set values", () => {
    expect(percentile([], 0.5)).toBeNull()
    expect(percentile([10], 0.5)).toBe(10)
    expect(percentile([10, 20, 30, 40, 50], 0.5)).toBe(30)
    expect(percentile([10, 20, 30, 40, 50], 0.95)).toBe(48)
  })

  it("summarizes a week and compares it to the prior week", () => {
    const daily: DayInsight[] = Array.from({ length: 14 }, (_, index) => ({
      date: `2026-10-${String(index + 1).padStart(2, "0")}`,
      count: index < 7 ? 2 : 4,
      completed: index < 7 ? 1 : 4,
      failed: index < 7 ? 1 : 0,
      successRate: index < 7 ? 50 : 100,
      medianDurationMs: 100,
      p95DurationMs: 200,
    }))
    expect(summarizeDays(daily.slice(0, 7))).toEqual({
      count: 14,
      failed: 7,
      successRate: 50,
    })
    const trend = weekOverWeek(daily)
    expect(trend.previous.count).toBe(14)
    expect(trend.current.count).toBe(28)
    expect(trend.current.successRate).toBe(100)
    expect(percentChange(trend.current.count, trend.previous.count)).toBe(100)
    expect(percentChange(trend.current.failed, trend.previous.failed)).toBe(
      -100,
    )
    expect(shareWidthClass(44)).toBe("w-[40%]")
    expect(shareWidthClass(96)).toBe("w-full")
  })

  it("reads duration from runs inside a date window", () => {
    const windowed = durationInRange(
      [
        { ...runs[0]!, startedAt: "2026-10-10T10:00:00.000Z", durationMs: 100 },
        { ...runs[1]!, startedAt: "2026-10-12T10:00:00.000Z", durationMs: 300 },
        { ...runs[2]!, startedAt: "2026-10-20T10:00:00.000Z", durationMs: 900 },
      ],
      "2026-10-10",
      "2026-10-12",
    )
    expect(windowed.median).toBe(200)
    expect(windowed.p95).toBe(290)
  })

  it("builds adjacent UTC intelligence windows", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-10-27T09:00:00.000Z"))
    expect(defaultIntelligenceQuery("invoice.import")).toEqual({
      workflow: "invoice.import",
      currentStartedAfter: "2026-10-21T00:00:00.000Z",
      currentStartedBefore: "2026-10-28T00:00:00.000Z",
      previousStartedAfter: "2026-10-14T00:00:00.000Z",
      previousStartedBefore: "2026-10-21T00:00:00.000Z",
    })
  })
})
