import { describe, expect, it } from "vitest"
import {
  commandPages,
  filterCommandPages,
  matchingProjects,
  normalizeSearchQuery,
  runHistoryHref,
  runHref,
  shouldRequestProjectSearch,
  workflowHref,
} from "../features/search/command-search"

const pages = commandPages("https://docs.example/docs/introduction")

describe("command palette search", () => {
  it("offers navigation pages before a query and filters them by label or keyword", () => {
    expect(filterCommandPages(pages, "  ").map((page) => page.id)).toEqual([
      "overview",
      "workflows",
      "runs",
      "insights",
      "issues",
      "settings",
      "documentation",
    ])
    expect(filterCommandPages(pages, "run").map((page) => page.id)).toEqual([
      "runs",
    ])
    expect(filterCommandPages(pages, "KEYS").map((page) => page.id)).toEqual([
      "settings",
    ])
    expect(filterCommandPages(pages, "docs")[0]?.href).toBe(
      "https://docs.example/docs/introduction",
    )
  })

  it("matches project names only after the query has text", () => {
    const projects = [
      { id: "1", name: "Billing" },
      { id: "2", name: "Customer imports" },
      { id: "3", name: "billing archive" },
    ]
    expect(matchingProjects(projects, "   ")).toEqual([])
    expect(
      matchingProjects(projects, "bill").map((project) => project.id),
    ).toEqual(["1", "3"])
    expect(matchingProjects(projects, "bill", 1)).toEqual([
      { id: "1", name: "Billing" },
    ])
  })

  it("normalizes the server query and builds detail links", () => {
    expect(normalizeSearchQuery(`  ${"a".repeat(250)}  `)).toHaveLength(200)
    expect(shouldRequestProjectSearch("   ")).toBe(false)
    expect(shouldRequestProjectSearch(" cust-1 ")).toBe(true)
    expect(workflowHref("customer import")).toBe("/workflows/customer%20import")
    expect(runHref("run-1")).toBe("/runs/run-1")
    expect(runHistoryHref(" cust-1 ")).toBe("/runs?search=cust-1")
  })
})
