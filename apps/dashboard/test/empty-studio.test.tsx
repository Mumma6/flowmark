import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, expect, it, vi } from "vitest"
import { StudioExplore } from "../features/explore/explore-page"
import { explorerDefaults } from "../features/runs/explorer/explorer-filters"

const query = vi.hoisted(() => ({
  snapshot: vi.fn(),
  explorer: vi.fn(),
  params: new URLSearchParams(),
}))
vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useSearchParams: () => query.params,
}))
vi.mock("../features/projects/queries", () => ({
  useSnapshot: query.snapshot,
}))
vi.mock("../features/projects/project-context", () => ({
  useProject: () => ({
    current: { id: "11111111-1111-4111-8111-111111111111" },
    projects: [],
    pending: false,
    error: null,
  }),
}))
vi.mock("../features/runs/explorer/use-run-explorer", () => ({
  useRunExplorer: query.explorer,
}))
vi.mock("../features/explore/explore-analytics-context", () => ({
  ExploreAnalyticsContext: () => "Period analytics",
}))
vi.mock("../features/journeys/reference-journey", () => ({
  ReferenceJourney: () => null,
}))
vi.mock("../features/runs/investigation/run-inspector", () => ({
  RunInspector: () => null,
}))

const success = { isSuccess: true, isPending: false, error: null }
const render = () => renderToStaticMarkup(createElement(StudioExplore))
beforeEach(() => {
  query.params = new URLSearchParams()
  query.snapshot.mockReturnValue({
    ...success,
    data: { metrics: { totalRuns: 0 }, workflows: [] },
  })
  query.explorer.mockReturnValue({
    filters: { ...explorerDefaults },
    list: { ...success },
    runs: [],
    total: 0,
    pageIndex: 0,
  })
})

it("offers a calm empty project without analytics, filters or pagination", () => {
  const html = render()
  expect(html).toContain("No recorded executions")
  expect(html).toContain("You can close Studio and return later.")
  expect(html).toContain("/onboarding?mode=guide&amp;step=instrument")
  expect(html).not.toMatch(
    /Period analytics|All filters|Previous|Install|verified/,
  )
})

it.each(["snapshot", "list"] as const)(
  "keeps %s failures explicit even with a cached zero count",
  (source) => {
    const failure = {
      isSuccess: false,
      error: { message: "Network unavailable" },
    }
    if (source === "snapshot") {
      query.snapshot.mockReturnValue({ ...query.snapshot(), ...failure })
    } else {
      query.explorer.mockReturnValue({ ...query.explorer(), list: failure })
    }
    const html = render()
    expect(html).toContain("Could not load data")
    expect(html).not.toContain("No recorded executions")
  },
)

it("keeps loading distinct from a confirmed empty project", () => {
  query.explorer.mockReturnValue({
    ...query.explorer(),
    list: { isSuccess: false, isPending: true, error: null },
  })
  const html = render()
  expect(html).toContain("Loading evidence")
  expect(html).not.toContain("No recorded executions")
})

it("keeps an empty filtered view actionable without claiming an empty project", () => {
  query.explorer.mockReturnValue({
    ...query.explorer(),
    filters: { ...explorerDefaults, status: "Failed" },
  })
  const html = render()
  expect(html).toContain("No evidence matches this view.")
  expect(html).toContain("Clear filters")
  expect(html).not.toContain("No recorded executions")
})

it("preserves an invalid evidence selection warning on an empty project", () => {
  query.params.set("selection", "damaged")
  expect(render()).toContain("Period selection not applied")
})

it("shows the first received execution even before the snapshot refreshes", () => {
  query.explorer.mockReturnValue({
    ...query.explorer(),
    total: 1,
    runs: [
      {
        id: "22222222-2222-4222-8222-222222222222",
        externalId: "import-42",
        workflow: "invoice.import",
        status: "Running",
        startedAt: "2026-11-17T12:00:00Z",
        durationMs: null,
        outcome: null,
        result: null,
      },
    ],
  })
  const html = render()
  expect(html).toContain("invoice.import")
  expect(html).toContain("No final outcome")
  expect(html).toContain("Not reported")
  expect(html).not.toContain("No recorded executions")
  expect(html.indexOf("Execution evidence")).toBeLessThan(
    html.indexOf("Period analytics"),
  )
})
