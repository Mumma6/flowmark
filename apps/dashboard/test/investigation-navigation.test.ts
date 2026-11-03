import { expect, it } from "vitest"
import {
  investigationReturn,
  runInvestigationPath,
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
