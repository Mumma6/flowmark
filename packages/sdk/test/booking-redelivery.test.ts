import assert from "node:assert/strict"
import { describe, expect, it } from "vitest"
import { recordBookingRedeliveries } from "../../../examples/booking-redelivery.js"
import { createFlowmarkWithTransport, MemoryTransport } from "../src/index.js"

async function capture(key: Parameters<typeof recordBookingRedeliveries>[1]) {
  const transport = new MemoryTransport()
  const client = createFlowmarkWithTransport({ transport })

  try {
    recordBookingRedeliveries(client, key)
    await client.flush()
    return transport.events
      .filter((event) => event.type === "started")
      .map(({ runId, properties }) => {
        const terminal = transport.events.find(
          (event) => event.runId === runId && event.type === "completed",
        )
        assert(terminal?.type === "completed")
        return {
          ...properties,
          changeId: properties?.changeId,
          outcome: terminal.outcome,
        }
      })
  } finally {
    await client.shutdown()
  }
}

type Captured = Awaited<ReturnType<typeof capture>>

function assertExactlyOneConfirmationPerChange(events: Captured) {
  assert.deepEqual(
    events
      .filter(({ outcome }) => outcome === "confirmation-sent")
      .map(({ changeId }) => changeId),
    ["C41", "C42"],
  )
}

describe("booking redelivery evidence", () => {
  it("reproduces three receipts and preserves both legitimate changes", async () => {
    const first = await capture("changeId")
    const second = await capture("changeId")
    expect(second).toEqual(first)
    expect(first).toEqual([
      {
        bookingRef: "B17",
        envelopeId: "E11",
        changeId: "C41",
        receiptId: "R11",
        synthetic: true,
        outcome: "confirmation-sent",
      },
      {
        bookingRef: "B17",
        envelopeId: "E12",
        changeId: "C41",
        receiptId: "R12",
        synthetic: true,
        outcome: "duplicate-suppressed",
      },
      {
        bookingRef: "B17",
        envelopeId: "E13",
        changeId: "C42",
        receiptId: "R13",
        synthetic: true,
        outcome: "confirmation-sent",
      },
    ])
    assertExactlyOneConfirmationPerChange(first)
  })

  it.each([
    ["envelopeId", ["C41", "C41", "C42"]],
    ["bookingRef", ["C41"]],
  ] as const)("rejects deduplication by %s", async (key, actual) => {
    const events = await capture(key)
    expect(
      events
        .filter(({ outcome }) => outcome === "confirmation-sent")
        .map(({ changeId }) => changeId),
    ).toEqual(actual)
    expect(() => assertExactlyOneConfirmationPerChange(events)).toThrow(
      assert.AssertionError,
    )
  })
})
