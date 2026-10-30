import { describe, expect, it } from "vitest"
import {
  declarationForRun,
  declaredResults,
  resultPath,
  type ResultDeclaration,
} from "../app/result-presentation"

const declaration: ResultDeclaration = {
  revision: "v1",
  fields: [
    { path: ["imported"], label: "Imported", kind: "count", unit: "rows" },
    { path: ["reasons"], label: "Rejected reasons", kind: "reasons" },
    { path: ["provider"], label: "Provider", kind: "category" },
  ],
}
describe("business result presentation", () => {
  it("requires an explicit immutable revision on the original start", () => {
    expect(declarationForRun([declaration], null)).toBeUndefined()
    expect(declarationForRun([declaration], {})).toBeUndefined()
    expect(declarationForRun([declaration], { definitionRevision: "v1" })).toBe(
      declaration,
    )
    expect(
      declarationForRun([declaration], { definitionRevision: "v2" }),
    ).toBeUndefined()
    expect(
      declarationForRun([declaration], { definitionRevision: null }),
    ).toBeUndefined()
  })
  it("renders ordered counts/reasons and distinguishes missing, zero and wrong types", () => {
    const fields = declaredResults(
      { imported: 0, reasons: { invalid_address: 100 }, provider: "crm-a" },
      declaration,
    )
    expect(fields[0]).toMatchObject({
      label: "Imported",
      value: "0",
      unit: "rows",
      state: "Reported",
    })
    expect(fields[1].reasons).toEqual([["invalid_address", 100]])
    expect(
      declaredResults({}, declaration).every(
        (field) => field.state === "Not reported",
      ),
    ).toBe(true)
    expect(
      declaredResults(
        { imported: "0", reasons: { bad: -1 }, provider: {} },
        declaration,
      ).every((field) => field.state === "Unexpected type"),
    ).toBe(true)
    expect(declaredResults({ imported: 1.5 }, declaration)[0].state).toBe(
      "Unexpected type",
    )
  })
  it("never traverses inherited values and bounds displayed reasons", () => {
    expect(resultPath({}, ["constructor"])).toBeUndefined()
    const reasons = Object.fromEntries(
      Array.from({ length: 30 }, (_, i) => [`reason-${i}`, i]),
    )
    const field = declaredResults({ reasons }, declaration)[1]
    expect(field.reasons).toHaveLength(24)
    expect(field.omittedReasons).toBe(6)
  })
})
