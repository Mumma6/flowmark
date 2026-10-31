import { describe, expect, it } from "vitest"
import { buildAttemptSequence } from "../app/run-attempts-presentation"

describe("explicit attempt presentation", () => {
  it("keeps actual ordinals, failed evidence and terminal-only occurrences regardless of arrival order", () => {
    const base = { operationName: "push", timestamp: "2026-10-31T10:00:00Z" }
    const failed = {
      ...base,
      id: "failed",
      operationId: "first",
      type: "operation_failed",
      attempt: { groupId: "batch", number: 1 },
      durationMs: 31,
    }
    const completed = {
      ...base,
      id: "completed",
      operationId: "later",
      type: "operation_completed",
      attempt: { groupId: "batch", number: 3 },
      durationMs: 12,
    }
    const rows = buildAttemptSequence([
      completed,
      failed,
      {
        ...base,
        id: "start",
        operationId: "first",
        type: "operation_started",
        attempt: { groupId: "batch", number: 1 },
      },
      { ...base, id: "page", operationId: "page", type: "operation_completed" },
    ])
    expect(rows).toMatchObject([
      {
        number: 1,
        status: "failed",
        durationMs: 31,
        hasStart: true,
        eventId: "failed",
      },
      {
        number: 3,
        status: "completed",
        durationMs: 12,
        hasStart: false,
        eventId: "completed",
      },
    ])
    expect(
      buildAttemptSequence([
        { ...base, id: "page", operationId: "page", type: "operation_started" },
      ]),
    ).toEqual([])
  })
})
