import { Schema } from "effect"
import { describe, expect, it } from "vitest"
import {
  ObservationRepairInputSchema,
  planObservationRepair,
  type ObservationRepairInput,
} from "../src/observation-repair.js"

const base = {
  questionId: "booking.receipt-link",
  questionRevision: 1,
  repository: "example/bookings",
  access: "authorized" as const,
  traffic: "fixture-ready" as const,
  approvedNamespaces: ["reschedule"],
  requestedNamespace: "reschedule",
  reportingSite: "src/bookings/confirm.ts",
  maxOverheadMs: 10,
  attempt: 1,
}

const planFor = (
  overrides: Partial<ObservationRepairInput> &
    Pick<ObservationRepairInput, "gap">,
) =>
  planObservationRepair(
    Schema.decodeUnknownSync(ObservationRepairInputSchema)({
      ...base,
      ...overrides,
    }),
  )

describe("smallest observation repair", () => {
  it("reuses an answered question, repairs a mapping, links an existing site, and refuses a restricted field", () => {
    expect(planFor({ gap: "already-answered" })).toMatchObject({
      status: "proposed",
      remedy: "reuse-event",
      files: [],
      overheadMs: 0,
      questionRevision: 1,
    })
    expect(planFor({ gap: "mapping-stale" })).toMatchObject({
      remedy: "repair-mapping",
      fields: [],
      overheadMs: 0,
      files: [{ path: "artifact-manifest.json" }],
    })
    const linked = planFor({ gap: "missing-change-link" })
    expect(linked).toMatchObject({
      remedy: "add-permitted-reference",
      questionRevision: 2,
      fields: ["reschedule"],
      overheadMs: 1,
    })
    expect(linked.explanation).toContain(
      "Production observation remains pending",
    )
    expect(planFor({ gap: "restricted-field" })).toMatchObject({
      status: "unsupported",
      remedy: "none",
      files: [],
    })
    expect(planFor({ gap: "no-safe-source" }).explanation).toContain(
      "unsupported",
    )
  })

  it("does not add capture for a denied read, immature traffic, a wider grant, or a field outside policy", () => {
    expect(
      planFor({ gap: "missing-observation", access: "denied" }),
    ).toMatchObject({ status: "refused", files: [], overheadMs: 0 })
    expect(
      planFor({ gap: "missing-change-link", traffic: "immature" }).explanation,
    ).toContain("immature")
    expect(
      planFor({ gap: "missing-observation", access: "wider-grant-required" }),
    ).toMatchObject({ status: "owner-approval", remedy: "none" })
    expect(
      planFor({
        gap: "missing-change-link",
        requestedNamespace: "customer-note",
      }),
    ).toMatchObject({ status: "unsupported", fields: [] })
    const observed = planFor({ gap: "missing-observation" })
    expect(observed.overheadMs).toBeLessThanOrEqual(base.maxOverheadMs)
    expect(
      observed.fields.every((field) => base.approvedNamespaces.includes(field)),
    ).toBe(true)
  })

  it("updates the same proposal on retry and never merges it", () => {
    const first = planFor({ gap: "missing-observation", attempt: 1 })
    const second = planFor({ gap: "missing-observation", attempt: 2 })
    expect(second.branch).toBe(first.branch)
    expect(second.branch).toBe("flowmark/repair-booking.receipt-link")
    expect(second.attempt).toBe(2)
    expect(second.merged).toBe(false)
    expect(first.merged).toBe(false)
    expect(second.production).toBe("pending")
  })
})
