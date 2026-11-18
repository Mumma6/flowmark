import { describe, expect, it } from "vitest"
import {
  healthExpectationQueryKey,
  healthPeriodQueryKey,
  processHealthSelection,
} from "../features/explore/process-health-selection"
import {
  confirmationInvestigationPath,
  confirmationQueryKey,
  readInspectorRunId,
} from "../features/runs/investigation/investigation-navigation"
import {
  explorerDefaults,
  readExplorerFilters,
} from "../features/runs/explorer/explorer-filters"

const now = new Date("2026-11-18T12:00:00.000Z")
const filters = { ...explorerDefaults, workflow: "appointment.book" }
const name = "external-confirmation"

describe("Explore process health", () => {
  it("uses the explicitly chosen UTC period and its adjacent baseline", () => {
    expect(processHealthSelection(filters, name, "7", now)).toEqual({
      kind: "selected",
      explicitWindow: false,
      input: {
        workflow: filters.workflow,
        expectationName: name,
        window: {
          startedAfter: "2026-11-12T00:00:00.000Z",
          startedBefore: "2026-11-19T00:00:00.000Z",
        },
        baseline: {
          startedAfter: "2026-11-05T00:00:00.000Z",
          startedBefore: "2026-11-12T00:00:00.000Z",
        },
      },
    })
    expect(processHealthSelection(filters, "", "7", now).kind).toBe(
      "unmeasured",
    )
  })

  it("preserves exact run windows and withholds unsupported and partial windows", () => {
    const exact = {
      ...filters,
      startedAfterExact: "2026-11-12T10:00:00.000Z",
      startedBeforeExclusive: "2026-11-18T11:00:00.000Z",
    }
    expect(processHealthSelection(exact, name, "30", now)).toEqual({
      kind: "selected",
      explicitWindow: true,
      input: {
        workflow: filters.workflow,
        expectationName: name,
        window: {
          startedAfter: exact.startedAfterExact,
          startedBefore: exact.startedBeforeExclusive,
        },
      },
    })
    expect(
      processHealthSelection(
        { ...exact, environment: "prod", status: "Failed" },
        name,
        "7",
        now,
      ),
    ).toMatchObject({ kind: "unsupported", filters: ["Status", "Environment"] })
    expect(
      processHealthSelection(
        { ...exact, startedBefore: "2026-11-14" },
        name,
        "7",
        now,
      ),
    ).toMatchObject({ kind: "unsupported", filters: ["Through"] })
    expect(
      processHealthSelection(
        { ...exact, startedBeforeExclusive: "" },
        name,
        "7",
        now,
      ),
    ).toEqual({ kind: "unavailable-window" })
  })

  it("opens one declaration without changing the underlying cohort or its return URL", () => {
    const original = new URLSearchParams({
      workflow: filters.workflow,
      startedAfterExact: "2026-11-12T10:00:00.000Z",
      startedBeforeExclusive: "2026-11-18T11:00:00.000Z",
      [healthExpectationQueryKey]: name,
      [healthPeriodQueryKey]: "30",
      days: "30",
    })
    const from = `/?${original}`
    const id = "089ab2bd-d3ea-495d-9f8a-748888ada930"
    const path = confirmationInvestigationPath(id, "confirmation / 2", from)
    const url = new URL(path, "http://localhost")
    expect(readInspectorRunId(url.pathname)).toBe(id)
    expect(url.searchParams.get("view")).toBe("confirmations")
    expect(url.searchParams.get(confirmationQueryKey)).toBe("confirmation / 2")
    expect(url.searchParams.get("from")).toBe(from)
    expect(url.searchParams.get(healthExpectationQueryKey)).toBe(name)
    expect(url.searchParams.get(healthPeriodQueryKey)).toBe("30")
    expect(url.searchParams.get("days")).toBe("30")
    expect(readExplorerFilters(url.searchParams)).toEqual(
      readExplorerFilters(original),
    )
  })
})
