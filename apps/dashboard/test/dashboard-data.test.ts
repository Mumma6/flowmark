import { describe, expect, it } from "vitest"
import { getRunDurationMs } from "../app/run-presentation"
import {
  filterRuns,
  formatDuration,
  groupBy,
  paginate,
  workflowFamily,
  type Run,
  type RunFilters,
} from "../app/dashboard-data"

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
