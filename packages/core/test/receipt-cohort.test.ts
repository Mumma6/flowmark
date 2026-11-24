import { describe, expect, it } from "vitest"
import {
  classifyReceiptCohort,
  receiptCohortStatement,
} from "../src/receipt-cohort.js"
import {
  evaluateRelease,
  ReleaseEvaluationInputSchema,
} from "../src/release-evaluation.js"
import { Schema } from "effect"

describe("receipt cohort", () => {
  it("labels the latest receipt and an older receipt without a serving claim", () => {
    const latest = classifyReceiptCohort({
      deploymentIds: ["newer"],
      latestDeploymentIds: ["newer"],
      scanTruncated: false,
    })
    const historical = classifyReceiptCohort({
      deploymentIds: ["older"],
      latestDeploymentIds: ["newer"],
      scanTruncated: false,
    })
    expect(latest.receiptClass).toBe("reported-current")
    expect(historical.receiptClass).toBe("historical")
    expect(latest.statement).toBe(receiptCohortStatement)
    expect(latest.statement).not.toContain("was serving")
    expect(historical.rateWithheld).toBe(false)
  })

  it("withholds a rate for mixed receipts and an incomplete scan", () => {
    const mixed = classifyReceiptCohort({
      deploymentIds: ["older", "newer"],
      latestDeploymentIds: ["newer"],
      scanTruncated: false,
    })
    const unknown = classifyReceiptCohort({
      deploymentIds: ["older"],
      latestDeploymentIds: ["newer"],
      scanTruncated: true,
    })
    expect(mixed).toMatchObject({
      receiptClass: "mixed-receipts",
      receiptIds: ["older", "newer"],
      rateWithheld: true,
    })
    expect(unknown).toMatchObject({
      receiptClass: "unknown",
      classMayBeIncomplete: true,
      rateWithheld: true,
    })
    expect(unknown.statement).toContain("not an interval")
  })

  it("is consumed by release evaluation", () => {
    const digest = (digit: string) => `sha256:${digit.repeat(64)}`
    const result = evaluateRelease(
      Schema.decodeUnknownSync(ReleaseEvaluationInputSchema)({
        questionId: "booking.receipt-link",
        questionRevision: 3,
        test: "packages/sdk/test/booking-redelivery.test.ts",
        guarantee: "One confirmation for each legitimate change.",
        bindingId: "00000000-0000-4000-8000-000000000010",
        intendedBehaviorRevision: "receipt-v2",
        citation: {
          status: "open",
          url: "https://flowmark.example/citations/booking-release",
        },
        access: "authorized",
        population: "known-compatible",
        rollout: "mixed",
        baseline: "present",
        maturity: "mature",
        artifacts: [
          {
            artifactDigest: digest("b"),
            deploymentId: "deploy-baseline",
            role: "baseline",
          },
          {
            artifactDigest: digest("a"),
            deploymentId: "deploy-successor",
            role: "successor",
          },
        ],
        cases: [],
      }),
    )
    expect(result.receiptCohort.receiptClass).toBe("mixed-receipts")
    expect(result.receiptCohort.rateWithheld).toBe(true)
    expect(result.rate).toBeNull()
    expect(result.receiptCohort.statement).not.toContain("was serving")
  })
})
