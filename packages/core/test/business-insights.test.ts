import { Schema } from "effect"
import { describe, expect, it } from "vitest"
import {
  BusinessInsightsQuerySchema,
  ResultDeclarationSchema,
  ResultSelectionSchema,
} from "../src/index.js"
const query = {
  workflow: "import",
  revision: "v1",
  path: ["saved"],
  currentStartedAfter: "2026-10-20T00:00:00.000Z",
  currentStartedBefore: "2026-10-27T00:00:00.000Z",
  previousStartedAfter: "2026-10-13T00:00:00.000Z",
  previousStartedBefore: "2026-10-20T00:00:00.000Z",
}
describe("bounded business outcome contracts", () => {
  it("keeps old declarations presentation-only and requires bounded explicit category aggregation", () => {
    expect(
      Schema.is(ResultDeclarationSchema)({
        revision: "v1",
        fields: [{ path: ["saved"], label: "Saved", kind: "count" }],
      }),
    ).toBe(true)
    expect(
      Schema.is(ResultDeclarationSchema)({
        revision: "v1",
        fields: [
          {
            path: ["category"],
            label: "Category",
            kind: "category",
            aggregate: true,
          },
        ],
      }),
    ).toBe(false)
    expect(
      Schema.is(ResultDeclarationSchema)({
        revision: "v1",
        fields: [
          {
            path: ["reasons"],
            label: "Reasons",
            kind: "reasons",
            aggregate: true,
            values: ["invalid", "invalid"],
          },
        ],
      }),
    ).toBe(false)
    expect(
      Schema.is(ResultDeclarationSchema)({
        revision: "v1",
        fields: [
          {
            path: ["reasons"],
            label: "Reasons",
            kind: "reasons",
            aggregate: true,
            values: ["invalid"],
          },
        ],
      }),
    ).toBe(true)
  })
  it("bounds periods, requires complete ratios/releases/dimensions and rejects invalid paths", () => {
    expect(Schema.is(BusinessInsightsQuerySchema)(query)).toBe(true)
    for (const change of [
      { currentStartedBefore: query.currentStartedAfter },
      { currentStartedBefore: "2026-12-27T00:00:00.000Z" },
      { numerator: ["saved"] },
      { releaseA: "a" },
      { releaseA: "a", releaseB: "a" },
      { businessKey: "provider" },
      { path: [] },
    ]) {
      expect(
        Schema.is(BusinessInsightsQuerySchema)({ ...query, ...change }),
      ).toBe(false)
    }
    expect(
      Schema.is(ResultSelectionSchema)({
        revision: "v1",
        path: ["saved"],
        operator: "gte",
        value: -1,
      }),
    ).toBe(false)
  })
})
