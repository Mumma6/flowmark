import { Array, Result } from "effect"
import { describe, expect, it } from "vitest"
import {
  projectPublicReadEvidence,
  type PublicReadEvidence,
} from "../src/public-read.js"
import { decodeSuppliedSnapshot } from "../src/snapshot.js"

const response = {
  selection: {
    projectId: "synthetic-project",
    runId: "synthetic-run",
    cursor: "opaque-private-cursor",
  },
  observedAt: "2026-11-15T10:00:00.000Z",
  summary: {
    id: "synthetic-run",
    workflow: "booking.confirmation",
    status: "Running",
    startedAt: "2026-11-15T09:00:00.000Z",
    durationMs: null,
  },
  page: {
    events: Array.makeBy(10, (index) => ({
      id: `event-${index}`,
      type: index === 9 ? "completed" : "progress",
      timestamp: "2026-11-15T09:01:00.000Z",
      properties: { secret: "WITHHELD_CANARY" },
    })),
    limit: 10,
    totalEvents: 45,
    nextCursor: "opaque-next-cursor",
  },
  credentials: "NEVER_COPY_THIS_KEY",
  result: { private: "WITHHELD_CANARY" },
} satisfies PublicReadEvidence & { credentials: string; result: unknown }

describe("public read to supplied evidence", () => {
  it("round-trips the actual supplied-view boundary with explicit truncation and no authority or payload", () => {
    const json = projectPublicReadEvidence(response).pipe(Result.getOrThrow)
    const snapshot = decodeSuppliedSnapshot(json).pipe(Result.getOrThrow)
    expect(snapshot.status).toBe("No final outcome")
    expect(snapshot.duration).toBe("Not reported")
    expect(snapshot.milestones).toHaveLength(8)
    expect(snapshot.evidenceNote).toContain("8 of 10 events")
    expect(snapshot.evidenceNote).toContain("45 events recorded")
    expect(snapshot.evidenceNote).toContain("continuation page")
    expect(snapshot.evidenceNote).toContain("More pages exist")
    expect(snapshot.evidenceNote).toContain(response.observedAt)
    expect(json).not.toMatch(
      /WITHHELD_CANARY|NEVER_COPY_THIS_KEY|opaque-private-cursor|opaque-next-cursor/,
    )
  })

  it("keeps an empty retained page explicit without inventing a business result", () => {
    const snapshot = projectPublicReadEvidence({
      ...response,
      selection: { ...response.selection, cursor: undefined },
      summary: { ...response.summary, status: "Completed" },
      page: { events: [], limit: 50, totalEvents: 0, nextCursor: null },
    }).pipe(Result.flatMap(decodeSuppliedSnapshot), Result.getOrThrow)
    expect(snapshot.status).toBe("Completed")
    expect(snapshot.milestones).toEqual([])
    expect(snapshot.metrics).toEqual([])
    expect(snapshot.emptyResult).toContain(
      "Completion does not mean every record succeeded",
    )
    expect(snapshot.evidenceNote).toContain("initial page")
    expect(snapshot.evidenceNote).toContain("No later page")
  })

  it("rejects mismatched scope and values that the receiving view cannot accept", () => {
    expect(
      Result.isFailure(
        projectPublicReadEvidence({
          ...response,
          summary: { ...response.summary, id: "foreign-run" },
        }),
      ),
    ).toBe(true)
    expect(
      Result.isFailure(
        projectPublicReadEvidence({
          ...response,
          summary: { ...response.summary, workflow: "x".repeat(8193) },
        }),
      ),
    ).toBe(true)
  })
})
