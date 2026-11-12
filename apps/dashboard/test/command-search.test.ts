import { describe, expect, it } from "vitest"
import {
  commandPages,
  filterCommandPages,
  matchingProjects,
  normalizeSearchQuery,
  distinctSearchReferences,
  exploreHref,
  referenceExploreHref,
  runSearchExploreHref,
  runHref,
  shouldRequestProjectSearch,
  workflowExploreHref,
} from "../features/search/command-search"

import {
  buildRunListInput,
  explorerDefaults,
  readExplorerFilters,
} from "../features/runs/explorer/explorer-filters"
import { investigationReturn } from "../features/runs/investigation/investigation-navigation"

const requestFor = (href: string) =>
  buildRunListInput(
    readExplorerFilters(new URL(href, "https://studio.example").searchParams),
  )

const pages = commandPages("https://docs.example/docs/introduction")

describe("command palette search", () => {
  it("offers navigation pages before a query and filters them by label or keyword", () => {
    expect(filterCommandPages(pages, "  ").map((page) => page.id)).toEqual([
      "explore",
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

  it("normalizes text without changing exact reference values", () => {
    expect(normalizeSearchQuery(`  ${"a".repeat(250)}  `)).toHaveLength(200)
    expect(shouldRequestProjectSearch("   ")).toBe(false)
    expect(shouldRequestProjectSearch(" cust-1 ")).toBe(true)
    expect(requestFor(workflowExploreHref("customer import"))).toMatchObject({
      workflow: "customer import",
      search: undefined,
    })
    expect(requestFor(runSearchExploreHref(" cust-1 "))).toMatchObject({
      search: "cust-1",
    })
    expect(
      requestFor(
        referenceExploreHref({
          workflow: "customer import",
          key: "customerId",
          value: " cust-1 ",
        }),
      ),
    ).toMatchObject({ businessValue: " cust-1 " })
  })
})

describe("Studio search to Explore", () => {
  const filters = readExplorerFilters(
    new URLSearchParams({
      workflow: "old.process",
      search: "unrelated",
      businessKey: "oldKey",
      businessValue: "oldValue",
      status: "Failed",
      release: "v2",
      environment: "staging",
      startedAfterExact: "2026-10-01T12:00:00Z",
      startedBeforeExclusive: "2026-11-01T12:00:00Z",
      definitionRevision: "r1",
      resultPath: '["accepted"]',
      resultValue: "0",
      resultOperator: "gte",
      resultKind: "count",
    }),
  )

  it("replaces process/reference scope while preserving exact evidence predicates", () => {
    const request = requestFor(workflowExploreHref("import & sync/#", filters))
    expect(request).toMatchObject({
      workflow: "import & sync/#",
      search: undefined,
      businessKey: undefined,
      businessValue: undefined,
      status: "Failed",
      release: "v2",
      environment: "staging",
      startedAfter: "2026-10-01T12:00:00Z",
      startedBeforeExclusive: "2026-11-01T12:00:00Z",
      resultSelection: {
        revision: "r1",
        path: ["accepted"],
        operator: "gte",
        value: 0,
      },
    })
  })

  it("opens a declared exact-reference cohort, not a single matching run or free-text search", () => {
    expect(
      requestFor(
        referenceExploreHref(
          {
            workflow: "invoices.import",
            key: "customerId",
            value: "ACME + /?&=001",
          },
          filters,
        ),
      ),
    ).toMatchObject({
      workflow: "invoices.import",
      businessKey: "customerId",
      businessValue: "ACME + /?&=001",
      search: undefined,
      status: "Failed",
      startedBeforeExclusive: "2026-11-01T12:00:00Z",
    })
  })

  it("retains malformed result predicates and invalid reference keys for API rejection", () => {
    const malformed = {
      ...filters,
      resultPath: "broken",
      resultValue: "not-a-number",
      ratioNumerator: "broken",
    }
    const request = requestFor(
      referenceExploreHref(
        { workflow: "invoices.import", key: "not allowed", value: "001" },
        malformed,
      ),
    )
    expect(request.resultSelection).toMatchObject({
      path: [],
      value: Number.NaN,
    })
    expect(request.ratioSelection).toMatchObject({ numerator: [] })
    expect(request.businessKey).toBe("not allowed")
    expect(
      requestFor(workflowExploreHref("invoices.import", malformed))
        .resultSelection,
    ).toMatchObject({ path: [], value: Number.NaN })
    expect(
      requestFor(runSearchExploreHref("import", malformed)).resultSelection,
    ).toMatchObject({ path: [], value: Number.NaN })
  })

  it("does not copy authority, pagination or unrelated route parameters into Explore", () => {
    const from = new URLSearchParams(
      "workflow=invoices.import&projectId=foreign&cursor=old&from=https://evil.example&view=events",
    )
    const href = exploreHref(readExplorerFilters(from))
    expect(new URL(href, "https://studio.example").searchParams.size).toBe(1)
    expect(requestFor(href)).toMatchObject({
      workflow: "invoices.import",
      cursor: undefined,
    })
    expect(exploreHref(explorerDefaults)).toBe("/")
  })

  it("roundtrips run return links to the same cohort including advanced filters", () => {
    const from = referenceExploreHref(
      { workflow: "invoices.import", key: "customerId", value: "001" },
      filters,
    )
    const detail = new URL(runHref("run/1", from), "https://studio.example")
    expect(detail.pathname).toBe("/runs/run%2F1")
    expect(investigationReturn(detail.searchParams.get("from"))).toEqual({
      href: from,
      label: "Back to Explore",
    })
    expect(
      requestFor(investigationReturn(detail.searchParams.get("from")).href),
    ).toEqual(requestFor(from))
  })

  it("deduplicates reference cohorts without collapsing different processes, fields or exact values", () => {
    const reference = {
      workflow: "invoices.import",
      key: "customerId",
      value: "001",
      runId: "run-1",
      externalId: "ext-1",
    }
    expect(
      distinctSearchReferences([
        reference,
        { ...reference, runId: "run-2" },
        { ...reference, workflow: "orders.fulfill" },
        { ...reference, key: "batchId" },
        { ...reference, value: "001 " },
      ]),
    ).toHaveLength(4)
  })
})
