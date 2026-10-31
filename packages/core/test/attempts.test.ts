import { Schema } from "effect"
import { describe, expect, it } from "vitest"
import { EventEnvelopeSchema, WorkflowAttemptSchema } from "../src/index.js"

describe("explicit attempt contract", () => {
  it.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, Infinity, NaN])(
    "rejects non-positive or unsafe ordinal %s",
    (number) => {
      expect(
        Schema.is(WorkflowAttemptSchema)({ groupId: "batch", number }),
      ).toBe(false)
    },
  )
  it.each(["", " ", "a".repeat(129)])("rejects invalid groups", (groupId) => {
    expect(Schema.is(WorkflowAttemptSchema)({ groupId, number: 1 })).toBe(false)
  })
  it("accepts gaps and rejects only the same qualified execution as retry target", () => {
    const envelope = {
      eventId: "00000000-0000-0000-0000-000000000001",
      event: {
        type: "started",
        workflow: "crm",
        runId: "run",
        timestamp: new Date().toISOString(),
        retryOf: { workflow: "crm", runId: "run" },
      },
    }
    expect(Schema.is(EventEnvelopeSchema)(envelope)).toBe(false)
    expect(
      Schema.is(EventEnvelopeSchema)({
        ...envelope,
        event: {
          ...envelope.event,
          retryOf: { workflow: "booking", runId: "run" },
        },
      }),
    ).toBe(true)
    expect(
      Schema.is(WorkflowAttemptSchema)({
        groupId: "batch",
        number: Number.MAX_SAFE_INTEGER,
      }),
    ).toBe(true)
  })
})
