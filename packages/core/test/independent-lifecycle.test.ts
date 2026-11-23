import { describe, expect, it } from "vitest"
import { summarizeWarehouseHandoffs } from "../../../examples/warehouse-transfer.js"
import { exerciseWarehouseLifecycle } from "../src/independent-lifecycle.js"

describe("warehouse lifecycle fixture", () => {
  const record = exerciseWarehouseLifecycle()

  it("starts from a clean connection and verifies fixture readback before traffic", () => {
    expect(record).toMatchObject({
      application: "warehouse-transfer",
      environment: "local-fixture",
      productionClaim: false,
      sessionsShareProtectedTranscript: false,
      first: {
        history: 0,
        manualIntervention: "none",
        remedy: "add-typed-observation",
        overheadMs: 5,
        production: "pending",
        readiness: "restored",
        answerability: "unrestored",
      },
    })
  })

  it("uses the next deployment for a test, a contrary case and an unknown", () => {
    expect(record.second).toEqual({
      retrieval: "available",
      caseLabel: "dock-handoff-v2",
      coverage: "observed",
      review: "ready",
      release: "supported",
      causalClaim: false,
      contrary: "contrary",
      unknownRemainsUnlisted: true,
    })
  })

  it("keeps loss, one repair, reuse, expiry, revocation and the unsupported field", () => {
    expect(record.loss).toBe("known-loss")
    expect(record.linkage).toEqual({ decision: "repair", count: 1 })
    expect(record.idempotent).toEqual({
      remedy: "reuse-event",
      overheadMs: 0,
      revision: 2,
      merged: false,
    })
    expect(record.citation).toBe("expired-citation")
    expect(record.revocation).toBe("denied")
    expect(record.unsupported).toBe("unsupported")
  })

  it("keeps the warehouse handoff synthetic and separate from a booking", () => {
    expect(summarizeWarehouseHandoffs()).toEqual({
      synthetic: true,
      picks: 1,
      docks: 1,
      shorts: 1,
    })
  })
})
