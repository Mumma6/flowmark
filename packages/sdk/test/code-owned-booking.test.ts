import { describe, expect, it } from "vitest"
import { Array } from "effect"
import { createFlowmarkWithTransport, MemoryTransport } from "../src/index.js"
import { submitCodeOwnedBooking } from "../../../examples/code-owned-booking.js"

describe("explicit code-owned booking example", () => {
  it("reports the chosen revision without uploading control-plane metadata", async () => {
    const transport = new MemoryTransport()
    const client = createFlowmarkWithTransport({ transport })
    try {
      await submitCodeOwnedBooking(
        client,
        "synthetic-reference",
        async (reference) => {
          expect(reference).toBe("synthetic-reference")
        },
      )
      await client.flush()
      expect(
        Array.findFirst(transport.events, (event) => event.type === "started"),
      ).toMatchObject({
        value: {
          workflow: "booking.create",
          properties: {
            bookingRef: "synthetic-reference",
            definitionRevision: "booking-v1",
          },
        },
      })
      expect(
        transport.events.some(
          (event) =>
            event.type === "completed" && event.outcome === "submitted",
        ),
      ).toBe(true)
      expect(
        transport.events.every(
          (event) =>
            !Object.hasOwn(event, "searchFields") &&
            !Object.hasOwn(event, "source"),
        ),
      ).toBe(true)
    } finally {
      await client.shutdown()
    }
  })
  it("preserves the application's error while recording failure", async () => {
    const transport = new MemoryTransport()
    const client = createFlowmarkWithTransport({ transport })
    const failure = new Error("synthetic provider rejection")
    try {
      await expect(
        submitCodeOwnedBooking(client, "synthetic-reference", async () => {
          throw failure
        }),
      ).rejects.toBe(failure)
      await client.flush()
      expect(transport.events.some((event) => event.type === "failed")).toBe(
        true,
      )
    } finally {
      await client.shutdown()
    }
  })
})
