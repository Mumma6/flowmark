import { describe, expect, it } from "vitest"
import { runBookingSetupDemo } from "./booking-setup-demo.runtime.js"

describe("booking setup demo", () => {
  it("preserves business errors and records in-memory evidence by default", async () => {
    const summary = await runBookingSetupDemo()
    expect(summary.mode).toBe("memory")
    expect(summary.awaitingTerminal).toBe(false)
    expect(summary.partialOutcome).toBe("no-availability")
    expect(summary.failedRunEvents).toBe(1)
    expect(summary.confirmedRunEvents).toBeGreaterThanOrEqual(3)
  })
})
