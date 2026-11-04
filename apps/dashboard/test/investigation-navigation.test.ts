import { expect, it } from "vitest"
import {
  buildRunListInput,
  readExplorerFilters,
} from "../features/runs/explorer-filters"
import {
  investigationReturn,
  runInvestigationPath,
  readInspectorRunId,
} from "../features/runs/investigation-navigation"

it("returns to the exact search cohort after opening a run and switching sections", () => {
  const source =
    "/runs?workflow=inventory.sync&status=Failed&startedBeforeExclusive=2026-11-04T00%3A00%3A00Z&filterView=technical"
  const target = new URL(
    runInvestigationPath("recorded-run", source, "timeline"),
    "https://flowmark.test",
  )
  expect(target.searchParams.get("view")).toBe("timeline")
  expect(investigationReturn(target.searchParams.get("from"))).toEqual({
    href: source,
    label: "Back to run results",
  })
})

it.each([
  null,
  "https://example.com",
  "//example.com",
  "/\\example.com",
  "/runs/another-run",
  "/settings",
  "/issues\n",
])("uses the run list for an unsupported return target: %s", (target) => {
  expect(investigationReturn(target)).toEqual({
    href: "/runs",
    label: "All runs",
  })
})

it("keeps a workflow investigation's selected tab and business reference", () => {
  const href =
    "/workflows/orders.fulfill?view=runs&businessKey=orderRef&businessValue=SYN-123"
  expect(investigationReturn(href)).toEqual({ href, label: "Back to workflow" })
})

it("returns to the exact Studio Explore population while preserving advanced evidence bounds", () => {
  const href =
    "/?workflow=appointment.book&expectationState=overdue&startedBeforeExclusive=2026-11-04T00%3A00%3A00Z"
  const target = new URL(
    runInvestigationPath("booking", href),
    "https://flowmark.test",
  )
  expect(investigationReturn(target.searchParams.get("from"))).toEqual({
    href,
    label: "Back to Explore",
  })
})

it("keeps the original overview available as a distinct return destination", () => {
  const href = "/overview?days=30"
  expect(investigationReturn(href)).toEqual({ href, label: "Back to Overview" })
})

it("keeps the mounted Explore request and cursor unchanged behind the inspector", () => {
  const filters = new URLSearchParams({
    workflow: "invoices.import",
    businessKey: "batchId",
    businessValue: "001 & /",
    status: "Failed",
    environment: "staging",
    release: "v2",
    startedAfterExact: "2026-10-01T12:00:00Z",
    startedBeforeExclusive: "2026-11-01T12:00:00Z",
    definitionRevision: "r1",
    resultPath: '["accepted"]',
    resultKind: "count",
    resultValue: "0",
    resultOperator: "gte",
  })
  const from = `/?${filters}`
  const target = new URL(
    runInvestigationPath("run-1", from, "timeline"),
    "https://flowmark.test",
  )
  expect(
    buildRunListInput(
      readExplorerFilters(target.searchParams),
      undefined,
      "cursor-page-3",
    ),
  ).toEqual(
    buildRunListInput(readExplorerFilters(filters), undefined, "cursor-page-3"),
  )
  expect(investigationReturn(target.searchParams.get("from")).href).toBe(from)
})

it("keeps invalid predicates invalid without copying authority or inspector state", () => {
  const from =
    "/?workflow=import&resultPath=broken&resultValue=NaN&definitionRevision=r1&projectId=foreign&cursor=old&event=old&view=runs"
  const target = new URL(
    runInvestigationPath("run-1", from),
    "https://flowmark.test",
  )
  const query = buildRunListInput(readExplorerFilters(target.searchParams))
  expect(query.resultSelection).toMatchObject({
    path: [],
    value: Number.NaN,
    revision: "r1",
  })
  expect(target.searchParams.has("projectId")).toBe(false)
  expect(target.searchParams.has("cursor")).toBe(false)
  expect(target.searchParams.has("event")).toBe(false)
  expect(target.searchParams.has("view")).toBe(false)
})

it("preserves the cohort while linking to a declaration or settlement event", () => {
  const from =
    "/?workflow=booking&startedBeforeExclusive=2026-11-04T00%3A00%3A00Z"
  const target = new URL(
    runInvestigationPath("run/1", from, "timeline", "event & 2"),
    "https://flowmark.test",
  )
  expect(target.pathname).toBe("/runs/run%2F1")
  expect(target.searchParams.get("event")).toBe("event & 2")
  expect(target.searchParams.get("view")).toBe("timeline")
  expect(target.searchParams.get("workflow")).toBe("booking")
  expect(investigationReturn(target.searchParams.get("from")).href).toBe(from)
})

it("recognizes only supported internal run locations for the mounted inspector", () => {
  expect(readInspectorRunId("/runs/cf13002c-a10f-41b8-9c15-5ce1b45ff854")).toBe(
    "cf13002c-a10f-41b8-9c15-5ce1b45ff854",
  )
  expect(readInspectorRunId("/runs/run_1")).toBe("run_1")
  expect(readInspectorRunId("/runs")).toBeUndefined()
  expect(readInspectorRunId("/runs/")).toBeUndefined()
  expect(readInspectorRunId("/runs/id/other")).toBeUndefined()
  expect(readInspectorRunId("//example.com/runs/id")).toBeUndefined()
  expect(readInspectorRunId("https://example.com/runs/id")).toBeUndefined()
  expect(readInspectorRunId("/runs/%malformed")).toBeUndefined()
})
