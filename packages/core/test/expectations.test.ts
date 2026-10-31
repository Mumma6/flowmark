import { Schema } from "effect"
import { describe, expect, it } from "vitest"
import {
  expectationDuration,
  expectationState,
  ExpectationReferenceSchema,
  EventEnvelopeSchema,
} from "../src/index.js"

describe("durable expectation rules", () => {
  it.each([
    ["1ms", 1],
    ["500ms", 500],
    ["60s", 60000],
    ["1m", 60000],
    ["1h", 3600000],
    ["7d", 604800000],
    ["604800000ms", 604800000],
  ])("converts bounded %s", (value, milliseconds) =>
    expect(expectationDuration(String(value))).toBe(milliseconds),
  )
  it.each([
    "0s",
    "01s",
    "-1s",
    "1.5m",
    "1H",
    " 1s",
    "1s ",
    "1h30m",
    "8d",
    "604800001ms",
    "999999999999999999999999d",
    "",
  ])("rejects %s", (value) =>
    expect(expectationDuration(value)).toBeUndefined(),
  )
  it("evaluates deterministic clock boundaries and negative outcomes independently of timing", () => {
    const deadline = "2026-10-31T12:05:00.000Z"
    expect(expectationState(deadline, null, null, deadline)).toBe("pending")
    expect(
      expectationState(deadline, null, null, "2026-10-31T12:05:00.001Z"),
    ).toBe("overdue")
    expect(
      expectationState(
        deadline,
        "expectation_resolved",
        deadline,
        "2026-11-01T12:00:00Z",
      ),
    ).toBe("met-on-time")
    expect(
      expectationState(
        deadline,
        "expectation_resolved",
        "2026-10-31T12:06:00Z",
        deadline,
      ),
    ).toBe("met-late")
    expect(
      expectationState(null, "expectation_resolved", deadline, deadline),
    ).toBe("unmatched")
    expect(
      expectationState(deadline, "expectation_cancelled", deadline, deadline),
    ).toBe("cancelled")
  })
  it("validates explicit reference versions and wire bounds", () => {
    const reference = {
      version: 1,
      workflow: "booking",
      runId: "run",
      expectationId: "confirmation",
    }
    expect(Schema.is(ExpectationReferenceSchema)(reference)).toBe(true)
    for (const invalid of [
      { ...reference, version: 2 },
      { ...reference, expectationId: " " },
      { ...reference, expectationId: "a".repeat(129) },
      { ...reference, expectationId: "bad\u0000id" },
    ]) {
      expect(Schema.is(ExpectationReferenceSchema)(invalid)).toBe(false)
    }
    const base = {
      eventId: crypto.randomUUID(),
      event: {
        type: "expectation_declared",
        workflow: "booking",
        runId: "run",
        expectationId: "confirmation",
        name: "provider-response",
        withinMs: 1,
        timestamp: new Date().toISOString(),
      },
    }
    expect(Schema.is(EventEnvelopeSchema)(base)).toBe(true)
    expect(
      Schema.is(EventEnvelopeSchema)({
        ...base,
        event: { ...base.event, withinMs: 0 },
      }),
    ).toBe(false)
  })
})
