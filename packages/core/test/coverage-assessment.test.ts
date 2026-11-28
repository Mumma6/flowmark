import { Array, Schema } from "effect"
import { describe, expect, it } from "vitest"
import {
  CoverageAssessmentInputSchema,
  assessLiveCoverage,
  type CoverageAssessmentInput,
} from "../src/coverage-assessment.js"

const release = `sha256:${"a".repeat(64)}`
const otherRelease = `sha256:${"b".repeat(64)}`
const eventId = (index: number) =>
  `00000000-0000-4000-8000-${index.toString(16).padStart(12, "0")}`
const handle = (index: number) => `case-${index.toString().padStart(3, "0")}`

const base = {
  questionId: "booking.receipt-link",
  questionRevision: 1,
  release,
  behaviorRevision: "receipt-v1",
  environment: "production",
  provenance: "fixture" as const,
  populationSource: { id: "booking-outbox", kind: "outbox" as const },
  window: {
    start: "2026-11-01T00:00:00.000Z",
    end: "2026-11-02T00:00:00.000Z",
  },
  maturityDelayMs: 0,
  observedAt: "2026-11-02T00:00:00.000Z",
  supportExpiresAt: null,
  sampling: "complete" as const,
  join: "case-handle" as const,
  drilldownLimit: 8,
  permittedHandles: Array.makeBy(8, (index) => handle(index + 192)),
  discovery: "matched" as const,
  readiness: "verified" as const,
  population: Array.makeBy(200, (index) => ({
    handle: handle(index),
    eligibleAt: "2026-11-01T01:00:00.000Z",
  })),
  deliveries: [
    ...Array.makeBy(192, (index) => ({
      eventId: eventId(index + 1),
      handle: handle(index),
      questionId: "booking.receipt-link",
      questionRevision: 1,
      release,
      environment: "production",
      behaviorRevision: "receipt-v1",
      occurredAt: "2026-11-01T02:00:00.000Z",
      admissible: true,
      mature: true,
      outcome: "accepted",
      confirmation: null,
      kind: "resolution" as const,
    })),
    ...Array.makeBy(10, (index) => ({
      eventId: eventId(index + 1),
      handle: handle(index),
      questionId: "booking.receipt-link",
      questionRevision: 1,
      release,
      environment: "production",
      behaviorRevision: "receipt-v1",
      occurredAt: "2026-11-01T02:00:00.000Z",
      admissible: true,
      mature: true,
      outcome: "accepted",
      confirmation: null,
      kind: "resolution" as const,
    })),
  ],
}

const assess = (overrides: Partial<CoverageAssessmentInput> = {}) =>
  assessLiveCoverage(
    Schema.decodeUnknownSync(CoverageAssessmentInputSchema)({
      ...base,
      ...overrides,
    }),
  )

describe("assessLiveCoverage", () => {
  it("resolves stored handles once and keeps unpermitted outcomes private", () => {
    const stored = {
      eventId: eventId(500),
      handle: handle(0),
      kind: "observation" as const,
      artifactDigest: release,
      environment: "production",
      behaviorRevision: "receipt-v1",
      occurredAt: "2026-11-01T02:00:00.000Z",
    }
    const result = assess({
      deliveries: [],
      discovery: "unknown",
      readiness: "unknown",
      population: [
        base.population[0]!,
        base.population[0]!,
        base.population[1]!,
      ],
      stored: [stored, { ...stored, eventId: eventId(501) }],
    })
    expect(result.discovery.status).toBe("unknown")
    expect(result.readiness.status).toBe("unknown")
    expect(result.answerability).toMatchObject({
      eligible: 2,
      resolved: 1,
      unresolved: 1,
      outcomes: [],
    })
    expect(
      assess({ deliveries: [], stored: [stored], storedTruncated: true })
        .answerability.rate,
    ).toBeNull()
    expect(
      assess({
        deliveries: [],
        stored: [{ ...stored, artifactDigest: otherRelease }],
      }).answerability,
    ).toMatchObject({ resolved: 0, rate: null })
  })

  it("returns 192/200 with a matching unresolved drilldown", () => {
    const result = assess()
    expect(result.discovery.status).toBe("matched")
    expect(result.readiness).toMatchObject({
      status: "verified",
      questionRevision: 1,
    })
    expect(result.answerability).toMatchObject({
      status: "partial",
      provenance: "fixture",
      environment: "production",
      eligible: 200,
      resolved: 192,
      unresolved: 8,
      rate: { resolved: 192, eligible: 200 },
      repair: "missing-observation",
    })
    expect(result.answerability.drilldown.map((item) => item.handle)).toEqual(
      Array.makeBy(8, (index) => handle(index + 192)),
    )
  })

  it("keeps a later window and a late confirmation from rewriting the original outcome", () => {
    const original = assess()
    const later = assess({
      window: {
        start: "2026-11-02T00:00:00.000Z",
        end: "2026-11-03T00:00:00.000Z",
      },
      observedAt: "2026-11-03T00:00:00.000Z",
      population: [
        { handle: "case-later", eligibleAt: "2026-11-02T01:00:00.000Z" },
      ],
      permittedHandles: ["case-later"],
      deliveries: [],
    })
    const confirmed = assess({
      permittedHandles: [handle(0)],
      deliveries: [
        ...base.deliveries,
        {
          eventId: eventId(400),
          handle: handle(0),
          questionId: "booking.receipt-link",
          questionRevision: 1,
          release,
          environment: "production",
          behaviorRevision: "receipt-v1",
          occurredAt: "2026-11-01T03:00:00.000Z",
          admissible: true,
          mature: true,
          outcome: "replaced",
          confirmation: "acknowledged",
          kind: "confirmation",
        },
        {
          eventId: eventId(401),
          handle: handle(0),
          questionId: "booking.receipt-link",
          questionRevision: 2,
          release: otherRelease,
          environment: "production",
          behaviorRevision: "receipt-v2",
          occurredAt: "2026-11-01T04:00:00.000Z",
          admissible: true,
          mature: true,
          outcome: "other-release",
          confirmation: "other-release",
          kind: "confirmation",
        },
      ],
    })
    expect(original.answerability.resolved).toBe(192)
    expect(later.answerability).toMatchObject({
      eligible: 1,
      resolved: 0,
      status: "waiting-for-eligible-traffic",
    })
    expect(confirmed.answerability.outcomes[0]).toEqual({
      handle: handle(0),
      outcome: "accepted",
      confirmation: "acknowledged",
    })
    expect(confirmed.answerability.rate).toEqual({
      resolved: 192,
      eligible: 200,
    })
  })

  it("distinguishes an empty population, immaturity, a missing counter, expiry, loss and an unsupported join", () => {
    expect(
      assess({ population: [], deliveries: [], permittedHandles: [] })
        .answerability.status,
    ).toBe("waiting-for-eligible-traffic")
    expect(
      assess({
        maturityDelayMs: 86_400_000,
        observedAt: "2026-11-01T02:00:00.000Z",
      }).answerability,
    ).toMatchObject({ status: "partial", limitation: "immature", resolved: 0 })
    expect(assess({ populationSource: null }).answerability).toMatchObject({
      status: "unknown-population",
      limitation: "missing-counter",
      rate: null,
      retained: 192,
    })
    expect(
      assess({
        supportExpiresAt: "2026-11-01T00:00:00.000Z",
      }).answerability.status,
    ).toBe("unsupported")
    expect(
      assess({
        deliveries: [
          ...base.deliveries,
          {
            eventId: eventId(300),
            handle: handle(192),
            questionId: "booking.receipt-link",
            questionRevision: 1,
            release,
            environment: "production",
            behaviorRevision: "receipt-v1",
            occurredAt: "2026-11-01T02:00:00.000Z",
            admissible: false,
            mature: true,
            outcome: null,
            confirmation: null,
            kind: "loss",
          },
        ],
      }).answerability,
    ).toMatchObject({ status: "known-loss", repair: "none", resolved: 192 })
    expect(assess({ join: "unsupported" }).answerability).toMatchObject({
      status: "unsupported",
      limitation: "unsupported-join",
      rate: null,
    })
    expect(assess({ sampling: "changed" }).answerability).toMatchObject({
      status: "unknown-population",
      limitation: "changed-sampling",
      rate: null,
      retained: 192,
    })
    expect(
      resultDiscovery(assess({ discovery: "source-only", readiness: "stale" })),
    ).toEqual({
      discovery: "source-only",
      readiness: "stale",
    })
  })
})

const resultDiscovery = (result: ReturnType<typeof assessLiveCoverage>) => ({
  discovery: result.discovery.status,
  readiness: result.readiness.status,
})
