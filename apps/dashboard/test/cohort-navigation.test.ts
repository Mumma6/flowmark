import { describe, expect, it } from "vitest"
import {
  buildRunListInput,
  readExplorerFilters,
} from "../features/runs/explorer/explorer-filters"
import {
  exploreCohortHref,
  mapRecordedChangeHrefs,
} from "../features/period/cohort-navigation"
import { failedRunsPath } from "../features/period/period-presentation"

describe("explore cohort navigation", () => {
  it("opens the same run.list input on Explore as on execution history", () => {
    const history = failedRunsPath({
      workflow: "imports.customers",
      code: "rejected",
      startedAfter: "2026-10-21T00:00:00.000Z",
      startedBefore: "2026-10-28T00:00:00.000Z",
    })
    const explore = exploreCohortHref(history)
    expect(explore).toContain("workflow=imports.customers")
    expect(explore).toContain("failCode=rejected")
    expect(
      buildRunListInput(
        readExplorerFilters(
          new URL(explore, "https://flowmark.test").searchParams,
        ),
      ),
    ).toEqual(
      buildRunListInput(
        readExplorerFilters(
          new URL(history, "https://flowmark.test").searchParams,
        ),
      ),
    )
  })

  it("maps recorded failure highlights onto Explore while keeping Issues links", () => {
    const mapped = mapRecordedChangeHrefs([
      {
        id: "failure",
        title: "rejected",
        detail: "detail",
        href: "/runs?status=Failed&failCode=rejected",
      },
      {
        id: "workflow",
        title: "billing",
        detail: "detail",
        href: "/issues?workflow=billing.charge",
      },
    ])
    expect(mapped[0]?.href.startsWith("/?")).toBe(true)
    expect(mapped[1]?.href).toBe("/issues?workflow=billing.charge")
  })
})
