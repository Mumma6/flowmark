import { Array, Match, Schema } from "effect"

const Text = Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(240))
const CitationUrl = Schema.String.check(
  Schema.isPattern(/^https:\/\/[a-zA-Z0-9._/-]{1,180}$/),
)

export const EvidenceReviewInputSchema = Schema.Struct({
  decision: Text,
  guarantee: Text,
  test: Schema.String.check(
    Schema.isPattern(
      /^(?!\/)(?!.*(?:^|\/)\.{1,2}(?:\/|$))[^\\:\p{Cc}]+\.test\.ts$/u,
    ),
  ),
  contrary: Text,
  missing: Text,
  expectation: Schema.Literals([
    "application-intent",
    "opposite-of-observed-bug",
  ]),
  synthetic: Schema.Boolean,
  citation: Schema.Struct({
    status: Schema.Literals(["open", "expired", "denied", "none"]),
    url: Schema.NullOr(CitationUrl),
  }),
  protectedText: Schema.Array(
    Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(80)),
  ).check(Schema.isMaxLength(8)),
})
export type EvidenceReviewInput = typeof EvidenceReviewInputSchema.Type

const citationLine = (
  citation: EvidenceReviewInput["citation"],
): { readonly line: string; readonly limitation: string | null } =>
  Match.value(citation.status).pipe(
    Match.when("open", () =>
      citation.url
        ? {
            line: `Citation: ${citation.url}. A reviewer reopens it under that reviewer's own grant.`,
            limitation: null,
          }
        : {
            line: "Citation: none.",
            limitation: "No citation URL was supplied.",
          },
    ),
    Match.when("expired", () => ({
      line: "Citation: expired. The handle cannot be reopened.",
      limitation: "The citation expired before review.",
    })),
    Match.when("denied", () => ({
      line: "Citation: denied. This grant cannot read the case.",
      limitation: "The reviewer's grant does not include the citation.",
    })),
    Match.when("none", () => ({
      line: "Citation: none.",
      limitation: null,
    })),
    Match.exhaustive,
  )

const leaks = (text: string, protectedText: readonly string[]) =>
  Array.some(
    protectedText,
    (secret) => secret.length > 0 && text.includes(secret),
  )

/**
 * Pair a decision with its ordinary test, citation, contrary case and gap.
 * Protected text never enters the pull request. The review does not merge.
 */
export const planEvidenceReview = (input: EvidenceReviewInput) => {
  const cited = citationLine(input.citation)
  const expectation =
    input.expectation === "application-intent"
      ? "Expectation: the test follows the application intent."
      : "Expectation: the test asserts the opposite of the observed bug."
  const execution = input.synthetic
    ? "Execution: synthetic fixture."
    : "Execution: unlabeled."
  const publicText = [
    "<!-- flowmark:review -->",
    `Decision: ${input.decision}`,
    `Guarantee: ${input.guarantee}`,
    `Test: ${input.test}`,
    expectation,
    `Contrary case: ${input.contrary}`,
    `Missing evidence: ${input.missing}`,
    cited.line,
    execution,
    "<!-- /flowmark:review -->",
  ].join("\n")
  if (!input.synthetic || leaks(publicText, input.protectedText)) {
    return {
      status: "withheld" as const,
      publicText: null,
      limitation: input.synthetic
        ? "Protected payloads or identifiers were kept out of the pull request."
        : "The execution is not labeled synthetic.",
    }
  }
  return {
    status: "ready" as const,
    publicText,
    limitation: cited.limitation,
  }
}
