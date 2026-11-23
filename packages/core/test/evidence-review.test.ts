import { Schema } from "effect"
import { describe, expect, it } from "vitest"
import {
  EvidenceReviewInputSchema,
  planEvidenceReview,
  type EvidenceReviewInput,
} from "../src/evidence-review.js"

const citation = "https://flowmark.example/citations/booking-redelivery"
const base = {
  decision: "Deduplicate a reschedule by its logical change.",
  guarantee:
    "One confirmation for each legitimate change, including a redelivery.",
  test: "packages/sdk/test/booking-redelivery.test.ts",
  contrary: "A second envelope for the same change is not a second reschedule.",
  missing: "Recipient delivery is unknown.",
  expectation: "application-intent" as const,
  synthetic: true,
  citation: { status: "open" as const, url: citation },
  protectedText: ["B17", "C41", "C42"],
}

const review = (overrides: Partial<EvidenceReviewInput> = {}) =>
  planEvidenceReview(
    Schema.decodeUnknownSync(EvidenceReviewInputSchema)({
      ...base,
      ...overrides,
      citation: { ...base.citation, ...overrides.citation },
    }),
  )

describe("planEvidenceReview", () => {
  it("pairs the decision, test, citation and contrary case without protected identifiers", () => {
    const ready = review()
    expect(ready.status).toBe("ready")
    expect(ready.publicText).toContain(`Test: ${base.test}`)
    expect(ready.publicText).toContain(citation)
    expect(ready.publicText).toContain("reviewer's own grant")
    expect(ready.publicText).toContain("Execution: synthetic fixture.")
    expect(ready.publicText).not.toContain("B17")
    expect(ready.publicText).not.toContain("C41")
    const leaked = review({
      contrary: "Change C41 was delivered twice for booking B17.",
    })
    expect(leaked).toEqual({
      status: "withheld",
      publicText: null,
      limitation:
        "Protected payloads or identifiers were kept out of the pull request.",
    })
  })

  it("states an expired or denied citation and allows a test that opposes an observed bug", () => {
    expect(
      review({ citation: { status: "expired", url: citation } }),
    ).toMatchObject({
      status: "ready",
      limitation: "The citation expired before review.",
    })
    expect(
      review({ citation: { status: "expired", url: citation } }).publicText,
    ).not.toContain(citation)
    expect(
      review({ citation: { status: "denied", url: citation } }),
    ).toMatchObject({
      limitation: "The reviewer's grant does not include the citation.",
    })
    expect(
      review({ expectation: "opposite-of-observed-bug" }).publicText,
    ).toContain("opposite of the observed bug")
    expect(review({ synthetic: false }).status).toBe("withheld")
  })
})
