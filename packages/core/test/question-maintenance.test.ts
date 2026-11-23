import { Schema } from "effect"
import { describe, expect, it } from "vitest"
import {
  QuestionMaintenanceInputSchema,
  maintainQuestion,
  type QuestionMaintenanceInput,
} from "../src/question-maintenance.js"

const base = {
  installationId: "install-bookings",
  repository: "example/bookings",
  behaviorId: "booking.reschedule",
  questionId: "booking.receipt-link",
  questionRevision: 3,
  previous: {
    behaviorRevision: "receipt-v1",
    probeId: "booking-delivery",
    path: "src/bookings/deliver.ts",
  },
  current: {
    behaviorRevision: "receipt-v1",
    probeId: "booking-delivery",
    path: "src/bookings/deliver.ts",
    change: "unchanged" as const,
  },
  exclusion: "none" as const,
  access: "authorized" as const,
  triggers: [{ kind: "traffic" as const, key: "window-1" }],
  pullRequest: { state: "none" as const, branch: null },
  fixtureReadback: "verified" as const,
  live: {
    deployment: "repaired" as const,
    eligibleObservations: 4,
    mature: true,
  },
  support: "current" as const,
}

const decide = (overrides: Partial<QuestionMaintenanceInput> = {}) =>
  maintainQuestion(
    Schema.decodeUnknownSync(QuestionMaintenanceInputSchema)({
      ...base,
      ...overrides,
      previous: { ...base.previous, ...overrides.previous },
      current: { ...base.current, ...overrides.current },
      pullRequest: { ...base.pullRequest, ...overrides.pullRequest },
      live: { ...base.live, ...overrides.live },
    }),
  )

describe("maintainQuestion", () => {
  it("preserves a moved probe and versions a semantic split", () => {
    const moved = decide({
      current: {
        ...base.current,
        path: "src/delivery/bookings.ts",
        change: "moved",
      },
      triggers: [
        { kind: "source", key: "move" },
        { kind: "deployment", key: "release-2" },
      ],
    })
    expect(moved.decision).toBe("preserve")
    expect(moved.meanings.current).toEqual(moved.meanings.previous)
    expect(moved.opensInstrumentation).toBe(false)
    const split = decide({
      current: {
        behaviorRevision: "receipt-v2",
        probeId: "booking-delivery",
        path: "src/bookings/deliver.ts",
        change: "split",
      },
    })
    expect(split.decision).toBe("successor")
    expect(split.meanings.previous).toMatchObject({
      questionRevision: 3,
      behaviorRevision: "receipt-v1",
      label: "prior",
    })
    expect(split.meanings.current.questionRevision).toBe(4)
    expect(split.opensInstrumentation).toBe(false)
  })

  it("coalesces a broken link into one repair and respects the open pull request", () => {
    const feature = decide({
      current: { ...base.current, change: "link-broken" },
      triggers: [
        { kind: "source", key: "diff" },
        { kind: "deployment", key: "release-2" },
        { kind: "traffic", key: "window-1" },
      ],
      pullRequest: { state: "open-feature", branch: "feature/receipt" },
    })
    expect(feature.repair).toEqual({
      count: 1,
      write: "feature-pr",
      branch: "feature/receipt",
      test: "test/flowmark-booking.receipt-link.test.ts",
    })
    expect(feature.triggerCount).toBe(3)
    const competing = decide({
      current: { ...base.current, change: "link-broken" },
      pullRequest: { state: "competing", branch: "other/edit" },
    })
    expect(competing.repair?.write).toBe("none")
    expect(competing.opensInstrumentation).toBe(false)
    const closed = decide({
      current: { ...base.current, change: "link-broken" },
      pullRequest: { state: "closed", branch: "flowmark/repair-old" },
    })
    expect(closed.repair?.branch).toBe(
      "flowmark/repair-booking.receipt-link-r3",
    )
    expect(closed.repair?.branch).not.toBe("flowmark/repair-old")
  })

  it("restores readiness from fixture readback and answerability only on the repaired deployment", () => {
    const ready = decide({
      live: { deployment: "other", eligibleObservations: 4, mature: true },
    })
    expect(ready.readiness).toBe("restored")
    expect(ready.answerability).toBe("unrestored")
    expect(ready.retrieval).toEqual({
      status: "unavailable",
      transcript: null,
      caseLabel: null,
    })
    const live = decide()
    expect(live.answerability).toBe("restored")
    expect(live.retrieval).toEqual({
      status: "available",
      transcript: null,
      caseLabel: "receipt-v1",
    })
    const revoked = decide({
      access: "revoked",
      current: { ...base.current, change: "link-broken" },
    })
    expect(revoked.retrieval.status).toBe("denied")
    expect(revoked.retrieval.caseLabel).toBeNull()
    expect(revoked.opensInstrumentation).toBe(false)
  })

  it("does not open instrumentation for a wait, an operator or an expired case", () => {
    expect(
      decide({
        live: { deployment: "none", eligibleObservations: 0, mature: false },
      }),
    ).toMatchObject({
      decision: "wait",
      opensInstrumentation: false,
      repair: null,
    })
    expect(decide({ access: "insufficient" })).toMatchObject({
      decision: "operator",
      opensInstrumentation: false,
    })
    expect(decide({ support: "expired" })).toMatchObject({
      decision: "unavailable",
      opensInstrumentation: false,
    })
    expect(decide({ exclusion: "retired" }).meanings.current.label).toBe(
      "current",
    )
    expect(
      decide({ exclusion: "retired" }).meanings.previous.behaviorRevision,
    ).toBe("receipt-v1")
  })
})
