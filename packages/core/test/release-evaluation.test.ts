import { Schema } from "effect"
import { describe, expect, it } from "vitest"
import {
  ReleaseEvaluationInputSchema,
  evaluateRelease,
  type ReleaseEvaluationInput,
} from "../src/release-evaluation.js"

const successor = `sha256:${"a".repeat(64)}`
const baseline = `sha256:${"b".repeat(64)}`
const base = {
  questionId: "booking.receipt-link",
  questionRevision: 3,
  test: "packages/sdk/test/booking-redelivery.test.ts",
  guarantee: "One confirmation for each legitimate change.",
  bindingId: "00000000-0000-4000-8000-000000000010",
  intendedBehaviorRevision: "receipt-v2",
  citation: {
    status: "open" as const,
    url: "https://flowmark.example/citations/booking-release",
  },
  access: "authorized" as const,
  population: "known-compatible" as const,
  rollout: "single" as const,
  baseline: "present" as const,
  maturity: "mature" as const,
  artifacts: [
    {
      artifactDigest: baseline,
      deploymentId: "deploy-baseline",
      role: "baseline" as const,
    },
    {
      artifactDigest: successor,
      deploymentId: "deploy-successor",
      role: "successor" as const,
    },
  ],
  cases: [
    {
      handle: "case-before",
      artifactDigest: baseline,
      deploymentId: "deploy-baseline",
      behaviorRevision: "receipt-v2",
      technical: "succeeded" as const,
      business: "intended" as const,
      mature: true,
    },
    {
      handle: "case-after",
      artifactDigest: successor,
      deploymentId: "deploy-successor",
      behaviorRevision: "receipt-v2",
      technical: "succeeded" as const,
      business: "contrary" as const,
      mature: true,
    },
  ],
}

const evaluate = (overrides: Partial<ReleaseEvaluationInput> = {}) =>
  evaluateRelease(
    Schema.decodeUnknownSync(ReleaseEvaluationInputSchema)({
      ...base,
      ...overrides,
      citation: { ...base.citation, ...overrides.citation },
    }),
  )

describe("evaluateRelease", () => {
  it("treats a business change as a counterexample even when both windows succeed technically", () => {
    const result = evaluate()
    expect(result.status).toBe("contrary")
    expect(result.counterexample).toEqual({
      handle: "case-after",
      artifactDigest: successor,
      deploymentId: "deploy-successor",
    })
    expect(result.rate).toEqual({ supporting: 0, observed: 1 })
    expect(result.causalClaim).toBe(false)
    expect(result.repair).toBe("investigate")
    expect(result.follow.test).toBe(base.test)
  })

  it("keeps mixed, rolled-back and late cases on the artifact that emitted them", () => {
    const mixed = evaluate({
      rollout: "mixed",
      cases: base.cases,
    })
    expect(mixed).toMatchObject({
      status: "inconclusive",
      reason: "mixed-rollout",
      rate: null,
    })
    expect(mixed.supporting.map((item) => item.artifactDigest)).toEqual([
      baseline,
    ])
    expect(mixed.contrary.map((item) => item.artifactDigest)).toEqual([
      successor,
    ])
    const rolled = evaluate({
      rollout: "rollback",
      artifacts: [
        { ...base.artifacts[0], role: "rolled-back" },
        base.artifacts[1],
      ],
      cases: [
        { ...base.cases[0], business: "intended" },
        { ...base.cases[1], business: "contrary" },
      ],
    })
    expect(rolled.status).toBe("supported")
    expect(rolled.rate).toBeNull()
    expect(rolled.contrary[0]?.artifactDigest).toBe(successor)
    const late = evaluate({ maturity: "late" })
    expect(late).toMatchObject({
      status: "waiting",
      reason: "late-evidence",
      rate: null,
    })
  })

  it("reports a new feature without a baseline and withholds a missing population", () => {
    const feature = evaluate({
      baseline: "absent",
      artifacts: [base.artifacts[1]],
      cases: [{ ...base.cases[1], business: "intended" }],
    })
    expect(feature).toMatchObject({
      status: "supported",
      reason: "no-baseline",
      rate: null,
    })
    expect(feature.supporting).toHaveLength(1)
    const missing = evaluate({
      population: "missing",
      cases: [],
    })
    expect(missing).toMatchObject({
      status: "inconclusive",
      reason: "missing-population",
      rate: null,
      repair: "missing-observation",
    })
  })

  it("hides current examples when the citation expired or the grant is revoked", () => {
    const expired = evaluate({
      citation: { status: "expired", url: base.citation.url },
    })
    expect(expired).toMatchObject({
      status: "inconclusive",
      reason: "expired-citation",
      supporting: [],
      contrary: [],
    })
    expect(expired.follow.citation).toBeNull()
    expect(expired.follow.questionId).toBe(base.questionId)
    const revoked = evaluate({ access: "revoked" })
    expect(revoked.status).toBe("denied")
    expect(revoked.supporting).toEqual([])
    expect(revoked.follow.citation).toBeNull()
  })
})
