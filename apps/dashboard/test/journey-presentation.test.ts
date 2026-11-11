import { describe, expect, it } from "vitest"
import type { JourneyEdge, JourneyNode } from "@flowmarkdev/core"
import { journeyParentDescription } from "../features/journeys/journey-presentation"

const node: JourneyNode = {
  id: "booking",
  externalId: "book-1",
  workflow: "appointment.book",
  startedAt: "2026-11-11T10:00:00Z",
  depth: 1,
  status: "Completed",
  outcome: "pending_confirmation",
  parent: {
    state: "resolved",
    matches: [
      {
        id: "parent",
        externalId: "parent-1",
        workflow: "patient.match",
        startedAt: "2026-11-11T09:00:00Z",
      },
    ],
  },
  retry: { state: "absent", matches: [] },
}
const edge: JourneyEdge = {
  fromRunId: "parent",
  toRunId: node.id,
  kind: "parent",
  scope: "context",
}

describe("journey relationship presentation", () => {
  it("distinguishes supporting context from explicit journey membership", () => {
    expect(journeyParentDescription(node, [edge])).toBe(
      "Reported parent · supporting context only",
    )
    expect(journeyParentDescription(node, [])).toBe(
      "Reported parent · supporting context only",
    )
    expect(
      journeyParentDescription(node, [{ ...edge, scope: "journey" }]),
    ).toBe("Reported parent · linked journey execution")
    expect(
      journeyParentDescription(node, [
        { ...edge, kind: "retry", scope: "journey" },
      ]),
    ).toBe("Reported parent · supporting context only")
  })
  it("keeps missing/ambiguous links distinct from an absent declaration", () => {
    expect(
      journeyParentDescription(
        { ...node, parent: { state: "absent", matches: [] } },
        [],
      ),
    ).toBe("No parent link reported.")
    expect(
      journeyParentDescription(
        { ...node, parent: { state: "missing", matches: [] } },
        [],
      ),
    ).toContain("missing from recorded evidence")
    expect(
      journeyParentDescription(
        { ...node, parent: { state: "ambiguous", matches: [] } },
        [],
      ),
    ).toContain("No parent was chosen")
  })
})
