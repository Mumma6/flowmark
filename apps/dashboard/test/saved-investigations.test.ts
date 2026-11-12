import { describe, expect, it } from "vitest"
import { Result } from "effect"
import {
  savedSelectionHref,
  decodeSavedSelection,
  privateInvestigationKey,
} from "../features/investigations/saved-selection"
import {
  interpretRunSelection,
  interpretPeriodCohort,
} from "../features/runs/investigation/investigation-selection"
import { readLinkedSelection } from "../features/insights/linked/linked-selection"
const projectId = "11111111-1111-4111-8111-111111111111"
const run = {
  version: 1 as const,
  kind: "run" as const,
  projectId,
  runId: "22222222-2222-4222-8222-222222222222",
  section: "related" as const,
  cursor: "cursor+/?%",
  limit: 3,
}
const windows = {
  currentStartedAfter: "2026-11-08T00:00:00.000Z",
  currentStartedBefore: "2026-11-15T00:00:00.000Z",
  previousStartedAfter: "2026-11-01T00:00:00.000Z",
  previousStartedBefore: "2026-11-08T00:00:00.000Z",
}
describe("private live selection navigation", () => {
  it("reopens the exact run evidence page rather than an arbitrary saved URL", () => {
    const url = new URL(
      Result.getOrThrow(savedSelectionHref(projectId, run)),
      "http://localhost",
    )
    expect(url.pathname).toBe(`/runs/${run.runId}`)
    expect(
      interpretRunSelection({
        raw: url.searchParams.get("selection"),
        projectId,
        runId: run.runId,
      }),
    ).toEqual({ _tag: "Accepted", selection: run })
    expect(
      Result.isFailure(
        decodeSavedSelection({
          ...run,
          returnUrl: "https://example.test",
          token: "private",
        }),
      ),
    ).toBe(true)
    expect(Result.isFailure(savedSelectionHref(run.runId, run))).toBe(true)
  })
  it("reopens absolute period windows through the existing strict Explore interpreter", () => {
    const selection = {
      version: 1 as const,
      kind: "period" as const,
      projectId,
      workflow: "booking.create",
      ...windows,
    }
    const url = new URL(
      Result.getOrThrow(savedSelectionHref(projectId, selection)),
      "http://localhost",
    )
    expect(
      interpretPeriodCohort({
        raw: url.searchParams.get("selection"),
        projectId,
        workflow: url.searchParams.get("workflow")!,
        startedAfterExact: url.searchParams.get("startedAfterExact")!,
        startedBeforeExclusive: url.searchParams.get("startedBeforeExclusive")!,
        definitionRevision: "",
        environment: "",
      }),
    ).toEqual({ _tag: "Accepted", selection })
  })
  it("preserves the linked comparison class and page and isolates private cache scopes", () => {
    const selection = {
      version: 1 as const,
      kind: "linked-comparison" as const,
      projectId,
      query: {
        upstreamWorkflow: "matching",
        downstreamWorkflow: "booking",
        upstreamRevision: "v1",
        downstreamRevision: "v2",
        numerator: ["confirmed"],
        denominator: ["requested"],
        ...windows,
      },
      evidence: {
        scope: "current" as const,
        coverage: "missingLink" as const,
        cursor: "opaque/?+",
      },
    }
    const url = new URL(
      Result.getOrThrow(savedSelectionHref(projectId, selection)),
      "http://localhost",
    )
    expect(
      Result.getOrThrow(
        readLinkedSelection(url.searchParams.get("linked"), projectId),
      ),
    ).toEqual(selection)
    expect(privateInvestigationKey("alice", projectId)).not.toEqual(
      privateInvestigationKey("bob", projectId),
    )
    expect(privateInvestigationKey("alice", projectId)).not.toEqual(
      privateInvestigationKey("alice", run.runId),
    )
  })
  it("rejects future versions, unknown filters and oversized cursors", () => {
    expect(Result.isFailure(decodeSavedSelection({ ...run, version: 2 }))).toBe(
      true,
    )
    expect(
      Result.isFailure(decodeSavedSelection({ ...run, environment: "prod" })),
    ).toBe(true)
    expect(
      Result.isFailure(
        decodeSavedSelection({ ...run, cursor: "a".repeat(2049) }),
      ),
    ).toBe(true)
  })
})
