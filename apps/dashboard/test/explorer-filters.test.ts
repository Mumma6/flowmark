import { Option } from "effect"
import { describe, expect, it } from "vitest"
import {
  buildRunListInput,
  parseResultPath,
  readExplorerFilters,
} from "../features/runs/explorer-filters"
import { peerSelection } from "../features/runs/peer-selection"

const input = (query: string, workflow?: string) =>
  buildRunListInput(readExplorerFilters(new URLSearchParams(query)), workflow)

describe("run history request contract", () => {
  it("preserves exclusive evidence bounds alongside inclusive user dates", () => {
    expect(
      input(
        "startedAfter=2026-10-01&startedAfterExact=2026-10-02T12:00:00Z&startedBefore=2026-10-03&startedBeforeExclusive=2026-10-04T00:00:00Z&terminalOnly=true",
      ),
    ).toMatchObject({
      startedAfter: "2026-10-02T12:00:00Z",
      startedBefore: "2026-10-03T23:59:59.999Z",
      startedBeforeExclusive: "2026-10-04T00:00:00Z",
      terminalOnly: true,
      limit: 25,
    })
  })
  it("keeps exact references workflow-scoped, with the route taking precedence", () => {
    expect(
      input("workflow=all&businessKey=batchId&businessValue=001").businessKey,
    ).toBeUndefined()
    expect(
      input(
        "workflow=other&businessKey=batchId&businessValue=001",
        "import.orders",
      ),
    ).toMatchObject({
      workflow: "import.orders",
      businessKey: "batchId",
      businessValue: "001",
    })
  })
  it("preserves invalid result and ratio selections for rejection by the API", () => {
    const request = input(
      "resultPath=invalid&resultValue=&ratioNumerator=invalid&definitionRevision=v1",
    )
    expect(request.resultSelection).toMatchObject({
      revision: "v1",
      path: [],
      value: Number.NaN,
    })
    expect(request.ratioSelection).toMatchObject({
      numerator: [],
      denominator: [],
    })
    expect(Option.isNone(parseResultPath('{"path":"items"}'))).toBe(true)
  })
  it("keeps numeric and categorical result predicates distinct", () => {
    const query = new URLSearchParams({
      resultPath: '["accepted"]',
      resultValue: "0",
      resultKind: "count",
      resultReason: "filtered",
      resultOperator: "gte",
      definitionRevision: "v1",
    })
    expect(input(query.toString()).resultSelection).toEqual({
      revision: "v1",
      path: ["accepted"],
      value: 0,
      operator: "gte",
      reason: "filtered",
    })
    query.set("resultKind", "category")
    expect(input(query.toString()).resultSelection?.value).toBe("0")
  })
  it("preserves cursor pagination, namespace mapping and trimmed search", () => {
    const filters = readExplorerFilters(
      new URLSearchParams(
        "namespace=server&search=%20reference%20&expectationState=overdue",
      ),
    )
    expect(buildRunListInput(filters, undefined, "next")).toMatchObject({
      namespace: "application",
      search: "reference",
      expectationState: "overdue",
      cursor: "next",
      limit: 25,
    })
  })
  it("does not silently replace invalid peer windows with a broader default", () => {
    expect(
      peerSelection(new URLSearchParams("peerDays=invalid"))?.days,
    ).toBeNaN()
    expect(
      peerSelection(
        new URLSearchParams(
          "peerEnvironment=all&peerRelease=same&peerDimension=region&peerValue=eu",
        ),
      ),
    ).toEqual({
      days: 30,
      environment: "all",
      sameRelease: true,
      dimensionKey: "region",
      dimensionValue: "eu",
    })
  })
})
