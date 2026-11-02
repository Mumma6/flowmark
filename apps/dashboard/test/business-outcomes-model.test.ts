import { describe, expect, it } from "vitest"
import {
  businessEvidencePath,
  selectBusinessOutcomes,
} from "../features/results/business-outcomes-model"
import type { ResultDeclaration } from "../features/results/result-presentation"
import type { RouterOutputs } from "../lib/api/types"

const declarations: ResultDeclaration[] = [
  {
    revision: "display",
    fields: [{ kind: "count", label: "Display", path: ["display"] }],
  },
  {
    revision: "v1",
    fields: [
      { kind: "count", label: "Accepted", path: ["accepted"], aggregate: true },
      { kind: "count", label: "Total", path: ["total"], aggregate: true },
    ],
  },
]
const params = (extra: Record<string, string> = {}) =>
  new URLSearchParams({
    biAfter: "2026-10-10",
    biBefore: "2026-10-17",
    ...extra,
  })

describe("business outcome selection and evidence", () => {
  it("defaults to a declared aggregatable revision with matching preceding UTC window", () => {
    const model = selectBusinessOutcomes(
      "orders.import",
      params(),
      declarations,
    )
    expect(model.selectedRevision).toBe("v1")
    expect(model.input).toMatchObject({
      path: ["accepted"],
      currentStartedAfter: "2026-10-10T00:00:00.000Z",
      currentStartedBefore: "2026-10-17T00:00:00.000Z",
      previousStartedAfter: "2026-10-03T00:00:00.000Z",
      previousStartedBefore: "2026-10-10T00:00:00.000Z",
    })
  })
  it("keeps unknown explicit revisions and paths unavailable", () => {
    expect(
      selectBusinessOutcomes(
        "orders.import",
        params({ biRevision: "unknown" }),
        declarations,
      ).field,
    ).toBeUndefined()
    expect(
      selectBusinessOutcomes(
        "orders.import",
        params({ biPath: '["unknown"]' }),
        declarations,
      ).input.path,
    ).toEqual([])
    expect(
      selectBusinessOutcomes(
        "orders.import",
        params({ biRevision: "" }),
        declarations,
      ).selectedRevision,
    ).toBe("")
  })
  it.each([
    { biBefore: "2026-10-10" },
    { biBefore: "invalid" },
    { biBefore: "2026-11-11" },
  ])("rejects non-positive, invalid or overlong intervals: %j", (extra) => {
    expect(
      selectBusinessOutcomes("orders.import", params(extra), declarations)
        .validDates,
    ).toBe(false)
  })
  it("uses the locked Insights cohort over business URL dates", () => {
    const model = selectBusinessOutcomes(
      "orders.import",
      params(),
      declarations,
      { after: "2026-10-01", before: "2026-10-31", days: 30 },
    )
    expect(model.after).toBe("2026-10-01")
    expect(model.before).toBe("2026-10-31")
  })
  it("keeps previous/release evidence, ratios and declared dimensions in the run link", () => {
    const model = selectBusinessOutcomes(
      "orders.import",
      params({
        biNumerator: '["accepted"]',
        biDenominator: '["total"]',
        biDimension: "region",
        biDimensionValue: "eu",
        biReleaseA: "release-a",
      }),
      declarations,
    )
    type Window =
      RouterOutputs["project"]["businessInsights"]["windows"][number]
    const previous = new URL(
      businessEvidencePath(model, { scope: "previous" } as Window, {
        ratio: true,
      }),
      "https://dashboard.example",
    )
    expect(Object.fromEntries(previous.searchParams)).toMatchObject({
      terminalOnly: "true",
      startedAfterExact: "2026-10-03T00:00:00.000Z",
      startedBeforeExclusive: "2026-10-10T00:00:00.000Z",
      definitionRevision: "v1",
      ratioNumerator: '["accepted"]',
      ratioDenominator: '["total"]',
      businessKey: "region",
      businessValue: "eu",
    })
    const release = new URL(
      businessEvidencePath(model, { scope: "releaseA" } as Window, {
        resultSelection: { value: 0, operator: "gte", reason: "empty" },
      }),
      "https://dashboard.example",
    )
    expect(Object.fromEntries(release.searchParams)).toMatchObject({
      release: "release-a",
      resultValue: "0",
      resultKind: "count",
      resultReason: "empty",
      resultPath: '["accepted"]',
    })
  })
})
