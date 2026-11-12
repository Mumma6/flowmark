import { describe, expect, it } from "vitest"
import { Result } from "effect"
import {
  buildLinkedQuery,
  linkedComparisonLocation,
  linkedDraft,
  readLinkedSelection,
} from "../features/insights/linked/linked-selection"
import {
  investigationReturn,
  runInvestigationPath,
} from "../features/runs/investigation/investigation-navigation"
import { linkedAvailabilityMessage } from "../features/insights/linked/linked-presentation"
import type {
  LinkedComparisonQuery,
  LinkedComparisonSelection,
} from "@flowmarkdev/core"

const query: LinkedComparisonQuery = {
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
  businessKey: "provider",
  businessValue: "cedar-health",
  releaseA: "old",
  releaseB: "new",
}
const selection: LinkedComparisonSelection = {
  version: 1,
  kind: "linked-comparison",
  projectId: "11111111-1111-4111-8111-111111111111",
  query,
  evidence: { scope: "current", coverage: "missingLink", cursor: "opaque+/?%" },
}

describe("linked comparison selection and return context", () => {
  it("round-trips the exact periods, revisions, dimension, releases and evidence page", () => {
    const location = linkedComparisonLocation(selection)
    const encoded = new URL(location, "http://localhost").searchParams.get(
      "linked",
    )
    expect(
      Result.getOrThrow(readLinkedSelection(encoded, selection.projectId)),
    ).toEqual(selection)
    const inspector = runInvestigationPath(
      "22222222-2222-4222-8222-222222222222",
      location,
    )
    expect(
      investigationReturn(
        new URL(inspector, "http://localhost").searchParams.get("from"),
      ),
    ).toEqual({ href: location, label: "Back to Insights" })
  })
  it("keeps a foreign or unsupported selection invalid rather than querying a default cohort", () => {
    expect(
      Result.isFailure(
        readLinkedSelection(
          JSON.stringify(selection),
          "33333333-3333-4333-8333-333333333333",
        ),
      ),
    ).toBe(true)
    expect(
      Result.isFailure(
        readLinkedSelection(
          JSON.stringify({
            ...selection,
            query: { ...query, environment: "production" },
          }),
          selection.projectId,
        ),
      ),
    ).toBe(true)
    expect(
      Result.isFailure(readLinkedSelection("not-json", selection.projectId)),
    ).toBe(true)
    expect(
      Result.getOrThrow(readLinkedSelection(null, selection.projectId)),
    ).toBeNull()
  })
  it("round-trips configured paths without confusing literal dots with nesting", () => {
    const draft = linkedDraft({ ...query, numerator: ["a.b"] })
    expect(Result.getOrThrow(buildLinkedQuery(draft))).toEqual({
      ...query,
      numerator: ["a.b"],
    })
    expect(
      Result.isFailure(buildLinkedQuery({ ...draft, businessValue: "" })),
    ).toBe(true)
    expect(Result.isFailure(buildLinkedQuery({ ...draft, releaseB: "" }))).toBe(
      true,
    )
  })
  it("uses explicit UTC even at a local daylight-saving boundary and rejects calendar overflow", () => {
    const draft = {
      ...linkedDraft(query),
      previousStartedAfter: "2026-03-21T00:00",
      previousStartedBefore: "2026-03-28T00:00",
      currentStartedAfter: "2026-03-29T02:30",
      currentStartedBefore: "2026-03-30T00:00",
    }
    expect(Result.getOrThrow(buildLinkedQuery(draft)).currentStartedAfter).toBe(
      "2026-03-29T02:30:00.000Z",
    )
    expect(
      Result.isFailure(
        buildLinkedQuery({ ...draft, currentStartedAfter: "2026-02-30T00:00" }),
      ),
    ).toBe(true)
  })
  it("explains unavailable baselines without claiming zero conversion or a cause", () => {
    expect(
      linkedAvailabilityMessage({
        available: false,
        reason: "Thin",
        minimumKnownPairs: 5,
        delta: null,
      }),
    ).toContain("five known pairs")
    expect(
      linkedAvailabilityMessage({
        available: false,
        reason: "Incompatible",
        minimumKnownPairs: 5,
        delta: null,
      }),
    ).toContain("only known compatible pairs")
  })
})
