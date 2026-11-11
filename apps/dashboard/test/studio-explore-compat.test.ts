import { describe, expect, it } from "vitest"
import { exploreAnalyticsQueryKey } from "../features/explore/explore-analytics-query"
import {
  buildRunListInput,
  readExplorerFilters,
} from "../features/runs/explorer/explorer-filters"

describe("Studio Explore compatibility", () => {
  it("keeps analytics tab state separate from explorer cohort filters", () => {
    const params = new URLSearchParams({
      workflow: "orders.fulfill",
      status: "Failed",
      [exploreAnalyticsQueryKey]: "failures",
      view: "timeline",
    })
    expect(buildRunListInput(readExplorerFilters(params))).toMatchObject({
      workflow: "orders.fulfill",
      status: "Failed",
    })
    expect(params.get(exploreAnalyticsQueryKey)).toBe("failures")
    expect(params.get("view")).toBe("timeline")
  })

  it("drops analytics state when opening execution history with view=runs", () => {
    const params = new URLSearchParams({
      workflow: "orders.fulfill",
      [exploreAnalyticsQueryKey]: "summary",
    })
    params.delete(exploreAnalyticsQueryKey)
    params.set("view", "runs")
    expect(params.toString()).toBe("workflow=orders.fulfill&view=runs")
  })
})
