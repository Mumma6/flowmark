import type { BusinessInsights } from "@flowmarkdev/core"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { expect, it } from "vitest"
import { BusinessPeriodChange } from "../features/business-evidence/business-period-change"

type BusinessWindow = BusinessInsights["windows"][number]

const sampleWindow = (overrides: Partial<BusinessWindow>): BusinessWindow => ({
  scope: "current",
  totalRuns: 5,
  finishedRuns: 4,
  failedRuns: 2,
  openRuns: 1,
  incompatibleRevision: 0,
  missingResult: 0,
  missingField: 0,
  wrongType: 0,
  unknownCategory: 0,
  knownRuns: 4,
  total: "9007199254740995.0",
  missingOutcome: 0,
  otherOutcomeRuns: 0,
  outcomes: [],
  categories: [],
  daily: [],
  ratio: { knownRuns: 0, numerator: null, denominator: null, value: null },
  ...overrides,
})

const report: BusinessInsights = {
  query: {
    workflow: "booking.create",
    revision: "v1",
    path: ["accepted"],
    currentStartedAfter: "2026-11-08T00:00:00.000Z",
    currentStartedBefore: "2026-11-15T00:00:00.000Z",
    previousStartedAfter: "2026-11-01T00:00:00.000Z",
    previousStartedBefore: "2026-11-08T00:00:00.000Z",
  },
  field: {
    path: ["accepted"],
    label: "Accepted bookings",
    kind: "count",
    unit: "bookings",
  },
  windows: [
    sampleWindow({}),
    sampleWindow({
      scope: "previous",
      failedRuns: 1,
      total: "9007199254740994",
    }),
  ],
  releaseComparison: { available: false, reason: null, minimumRuns: 0 },
}

const render = (input: BusinessInsights) =>
  renderToStaticMarkup(createElement(BusinessPeriodChange, { report: input }))

it("compares exact large totals and uses terminal runs for failure share", () => {
  const html = render(report)
  expect(html).toContain("+1 bookings")
  expect(html).toContain("+25 percentage points")
})

it("withholds a change when the baseline has no recorded runs", () => {
  const html = render({
    ...report,
    windows: [
      sampleWindow({}),
      sampleWindow({ scope: "previous", totalRuns: 0 }),
    ],
  })
  expect(html).toContain("Both periods need recorded runs")
  expect(html).not.toContain("percentage points")
})

it("withholds changes for overlapping windows and preserves missing measures", () => {
  expect(
    render({
      ...report,
      query: {
        ...report.query,
        currentStartedAfter: "2026-11-07T00:00:00.000Z",
        currentStartedBefore: "2026-11-14T00:00:00.000Z",
      },
    }),
  ).toContain("without overlap")
  expect(
    render({
      ...report,
      windows: [
        sampleWindow({}),
        sampleWindow({ scope: "previous", total: null }),
      ],
    }),
  ).toContain("Both periods need a reported total")
})
