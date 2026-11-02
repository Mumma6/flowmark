import { describe, expect, it } from "vitest"
import { periodWindow } from "../app/dashboard-data"
import {
  failedRunsPath,
  insightsPath,
  issuesPath,
  recordedChanges,
} from "../app/period-presentation"

describe("period windows", () => {
  it("uses the same seven-day UTC cohort as the overview comparison", () => {
    const period = periodWindow(7, new Date("2026-10-27T09:00:00.000Z"))
    expect(period).toMatchObject({
      currentStartedAfter: "2026-10-21T00:00:00.000Z",
      currentStartedBefore: "2026-10-28T00:00:00.000Z",
      previousStartedAfter: "2026-10-14T00:00:00.000Z",
      previousStartedBefore: "2026-10-21T00:00:00.000Z",
      after: "2026-10-21",
      before: "2026-10-28",
    })
    expect(
      Date.parse(period.currentStartedBefore) -
        Date.parse(period.currentStartedAfter),
    ).toBe(7 * 86_400_000)
  })

  it("keeps a 30-day window inside the 31-day read limit", () => {
    const period = periodWindow(30, new Date("2026-10-27T09:00:00.000Z"))
    const current =
      Date.parse(period.currentStartedBefore) -
      Date.parse(period.currentStartedAfter)
    const previous =
      Date.parse(period.previousStartedBefore) -
      Date.parse(period.previousStartedAfter)
    expect(current).toBe(30 * 86_400_000)
    expect(previous).toBe(current)
    expect(period.previousStartedBefore).toBe(period.currentStartedAfter)
  })
})

describe("investigation links", () => {
  it("preserves the half-open window and omits an empty failure code", () => {
    expect(insightsPath(7)).toBe("/insights")
    expect(insightsPath(30, "customer import")).toBe(
      "/insights?days=30&workflow=customer+import",
    )
    expect(issuesPath(7, "billing.charge")).toBe(
      "/issues?workflow=billing.charge",
    )
    expect(
      failedRunsPath({
        workflow: "imports.customers",
        code: "",
        startedAfter: "2026-10-21T00:00:00.000Z",
        startedBefore: "2026-10-28T00:00:00.000Z",
      }),
    ).toBe(
      "/runs?status=Failed&startedAfterExact=2026-10-21T00%3A00%3A00.000Z&startedBeforeExclusive=2026-10-28T00%3A00%3A00.000Z&workflow=imports.customers",
    )
  })
})

describe("recorded changes", () => {
  const window = {
    days: 7 as const,
    startedAfter: "2026-10-21T00:00:00.000Z",
    startedBefore: "2026-10-28T00:00:00.000Z",
  }

  it("highlights an increased failure code and does not repeat that workflow", () => {
    const changes = recordedChanges({
      ...window,
      failureGroups: [
        {
          workflow: "imports.customers",
          code: "rejected",
          currentCount: 12,
          countDelta: 9,
        },
      ],
      workflows: [
        {
          name: "imports.customers",
          current: { finishedRuns: 20, failedRuns: 12, successRate: 40 },
          previous: { finishedRuns: 20, failedRuns: 3, successRate: 85 },
        },
        {
          name: "billing.charge",
          current: { finishedRuns: 10, failedRuns: 4, successRate: 60 },
          previous: { finishedRuns: 10, failedRuns: 1, successRate: 90 },
        },
      ],
      operations: [],
    })
    expect(changes.map((change) => change.title)).toEqual([
      "rejected on imports.customers",
      "billing.charge failed more often",
    ])
    expect(changes[0]?.href).toContain("failCode=rejected")
    expect(changes[1]?.href).toBe("/issues?workflow=billing.charge")
  })

  it("does not treat a small sample or a flat failure count as a highlight", () => {
    const changes = recordedChanges({
      ...window,
      failureGroups: [
        {
          workflow: "imports.customers",
          code: "rejected",
          currentCount: 2,
          countDelta: 0,
        },
      ],
      workflows: [
        {
          name: "imports.customers",
          current: { finishedRuns: 2, failedRuns: 2, successRate: 0 },
          previous: { finishedRuns: 8, failedRuns: 1, successRate: 87.5 },
        },
      ],
      operations: [
        {
          name: "save",
          currentRunCount: 1,
          previousRunCount: 8,
          currentMedianDurationMs: 5000,
          previousMedianDurationMs: 100,
          durationDeltaMs: 4900,
          currentRunIds: ["run-1"],
        },
      ],
    })
    expect(changes).toEqual([])
  })
})
