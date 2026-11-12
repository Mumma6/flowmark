import { Schema, Result } from "effect"
import { describe, expect, it } from "vitest"
import {
  LinkedComparisonQuerySchema,
  linkedComparisonAvailability,
  type LinkedComparisonWindow,
} from "../src/index.js"

const query = {
  upstreamWorkflow: "patient.match",
  upstreamRevision: "v1",
  downstreamWorkflow: "appointment.book",
  downstreamRevision: "v1",
  numerator: ["confirmed"],
  denominator: ["requested"],
  currentStartedAfter: "2026-10-08T00:00:00.000Z",
  currentStartedBefore: "2026-10-15T00:00:00.000Z",
  previousStartedAfter: "2026-10-01T00:00:00.000Z",
  previousStartedBefore: "2026-10-08T00:00:00.000Z",
}
const window = (
  scope: "current" | "previous",
  changes: Partial<LinkedComparisonWindow> = {},
): LinkedComparisonWindow => {
  const known = changes.knownPairs ?? 10
  const anchors = changes.anchors ?? 12
  return {
    scope,
    anchors,
    knownPairs: known,
    coverage: {
      upstreamRevision: 0,
      ambiguousParent: 0,
      missingLink: anchors - known,
      multipleLinks: 0,
      releaseMismatch: 0,
      downstreamRevision: 0,
      unfinished: 0,
      missingResult: 0,
      missingMetric: 0,
      invalidMetric: 0,
      known,
    },
    failedKnownPairs: 0,
    numerator: "50",
    denominator: "100",
    ratio: 0.5,
    ...changes,
  }
}

describe("linked execution comparison contract", () => {
  it("shows a descriptive difference only for two compatible supported windows", () => {
    expect(
      linkedComparisonAvailability([
        window("current", {
          ratio: 0.75,
          numerator: "45",
          denominator: "60",
          anchors: 14,
          knownPairs: 6,
        }),
        window("previous"),
      ]),
    ).toMatchObject({ available: true, delta: 0.25 })
  })
  it("keeps the worked mixed-revision example unavailable even with sufficient known pairs", () => {
    const current = window("current", {
      anchors: 14,
      knownPairs: 6,
      numerator: "45",
      denominator: "60",
      ratio: 0.75,
    })
    expect(
      linkedComparisonAvailability([
        {
          ...current,
          coverage: {
            ...current.coverage,
            upstreamRevision: 1,
            downstreamRevision: 1,
            missingLink: 6,
          },
        },
        window("previous"),
      ]),
    ).toMatchObject({ available: false, reason: "Incompatible", delta: null })
  })
  it("distinguishes empty, thin and zero-denominator evidence", () => {
    expect(
      linkedComparisonAvailability([
        window("current", { anchors: 0, knownPairs: 0 }),
        window("previous"),
      ]).reason,
    ).toBe("Empty")
    expect(
      linkedComparisonAvailability([
        window("current", { knownPairs: 4 }),
        window("previous"),
      ]).reason,
    ).toBe("Thin")
    expect(
      linkedComparisonAvailability([
        window("current", { ratio: null, denominator: "0" }),
        window("previous"),
      ]).reason,
    ).toBe("ZeroDenominator")
    expect(
      linkedComparisonAvailability([window("current"), window("current")])
        .available,
    ).toBe(false)
  })
  it.each([
    { ...query, upstreamWorkflow: query.downstreamWorkflow },
    { ...query, environment: "production" },
    { ...query, previousStartedBefore: "2026-10-09T00:00:00.000Z" },
    { ...query, currentStartedBefore: "2026-11-09T00:00:00.000Z" },
    { ...query, businessKey: "provider" },
    { ...query, releaseA: "release-a" },
    { ...query, releaseA: "same", releaseB: "same" },
  ])(
    "rejects unsupported or ambiguous selections without widening them: %j",
    (input) => {
      expect(
        Result.isFailure(
          Schema.decodeUnknownResult(LinkedComparisonQuerySchema, {
            onExcessProperty: "error",
          })(input),
        ),
      ).toBe(true)
    },
  )
})
