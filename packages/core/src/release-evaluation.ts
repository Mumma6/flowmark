import { Array, Option, Schema } from "effect"
import { classifyReceiptCohort } from "./receipt-cohort.js"

const Identifier = Schema.String.check(
  Schema.isPattern(/^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,159}$/),
)
const Digest = Schema.String.check(Schema.isPattern(/^sha256:[a-f0-9]{64}$/))
const Handle = Schema.String.check(
  Schema.isPattern(/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,79}$/),
)
const Text = Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(200))
const CitationUrl = Schema.String.check(
  Schema.isPattern(/^https:\/\/[a-zA-Z0-9._/-]{1,180}$/),
)

const CaseSchema = Schema.Struct({
  handle: Handle,
  artifactDigest: Digest,
  deploymentId: Identifier,
  behaviorRevision: Identifier,
  technical: Schema.Literals(["succeeded", "failed"]),
  business: Schema.Literals(["intended", "contrary", "unknown"]),
  mature: Schema.Boolean,
})

const ArtifactSchema = Schema.Struct({
  artifactDigest: Digest,
  deploymentId: Identifier,
  role: Schema.Literals(["baseline", "successor", "rolled-back"]),
})

export const ReleaseEvaluationInputSchema = Schema.Struct({
  questionId: Identifier,
  questionRevision: Schema.Int.check(
    Schema.isBetween({ minimum: 1, maximum: 1_000_000 }),
  ),
  test: Schema.String.check(
    Schema.isPattern(
      /^(?!\/)(?!.*(?:^|\/)\.{1,2}(?:\/|$))[^\\:\p{Cc}]+\.test\.ts$/u,
    ),
  ),
  guarantee: Text,
  bindingId: Schema.String.check(Schema.isUUID()),
  intendedBehaviorRevision: Identifier,
  citation: Schema.Struct({
    status: Schema.Literals(["open", "expired", "denied"]),
    url: Schema.NullOr(CitationUrl),
  }),
  access: Schema.Literals(["authorized", "revoked"]),
  population: Schema.Literals([
    "known-compatible",
    "missing",
    "incompatible-meaning",
  ]),
  rollout: Schema.Literals(["single", "mixed", "rollback"]),
  baseline: Schema.Literals(["present", "absent"]),
  maturity: Schema.Literals(["mature", "waiting", "late"]),
  artifacts: Schema.Array(ArtifactSchema).check(
    Schema.isMinLength(1),
    Schema.isMaxLength(3),
  ),
  cases: Schema.Array(CaseSchema).check(Schema.isMaxLength(24)),
})
export type ReleaseEvaluationInput = typeof ReleaseEvaluationInputSchema.Type

type ReleaseCase = typeof CaseSchema.Type

const bound = (item: ReleaseCase) => ({
  handle: item.handle,
  artifactDigest: item.artifactDigest,
  deploymentId: item.deploymentId,
})

const emptyFollow = (
  input: ReleaseEvaluationInput,
  citation: string | null,
) => ({
  questionId: input.questionId,
  questionRevision: input.questionRevision,
  test: input.test,
  citation,
})

/**
 * Check one reviewed distinction against the artifact that emitted each case.
 * Technical success and the deploy itself are not the verdict. No release is approved.
 */
export const evaluateRelease = (input: ReleaseEvaluationInput) => {
  const latestDeploymentId = Array.findFirst(
    input.artifacts,
    (artifact) => artifact.role === "successor",
  ).pipe(Option.map((artifact) => artifact.deploymentId))
  const receiptCohort = classifyReceiptCohort({
    deploymentIds:
      input.rollout === "mixed"
        ? Array.map(input.artifacts, (artifact) => artifact.deploymentId)
        : Option.match(latestDeploymentId, {
            onNone: () =>
              Array.map(input.artifacts, (artifact) => artifact.deploymentId),
            onSome: (deploymentId) => [deploymentId],
          }),
    latestDeploymentIds: Option.match(latestDeploymentId, {
      onNone: () => [],
      onSome: (deploymentId) => [deploymentId],
    }),
    scanTruncated: false,
  })
  const follow = emptyFollow(
    input,
    input.citation.status === "open" ? input.citation.url : null,
  )
  const hidden = {
    supporting: [],
    contrary: [],
    counterexample: null,
    rate: null,
    causalClaim: false as const,
    follow,
    repair: "none" as const,
    receiptCohort,
  }
  if (input.access === "revoked") {
    return {
      ...hidden,
      status: "denied" as const,
      reason: "revoked-grant" as const,
      follow: emptyFollow(input, null),
    }
  }
  if (input.citation.status !== "open") {
    return {
      ...hidden,
      status: "inconclusive" as const,
      reason:
        input.citation.status === "expired"
          ? ("expired-citation" as const)
          : ("denied-citation" as const),
    }
  }
  const knownArtifact = (item: ReleaseCase) =>
    Array.some(
      input.artifacts,
      (artifact) =>
        artifact.artifactDigest === item.artifactDigest &&
        artifact.deploymentId === item.deploymentId,
    )
  const scoped = Array.filter(
    input.cases,
    (item) =>
      knownArtifact(item) &&
      item.behaviorRevision === input.intendedBehaviorRevision,
  )
  const serving =
    input.rollout === "rollback"
      ? Array.filter(
          input.artifacts,
          (artifact) => artifact.role === "rolled-back",
        )
      : Array.filter(
          input.artifacts,
          (artifact) => artifact.role === "successor",
        )
  const onServing = Array.filter(scoped, (item) =>
    Array.some(
      serving,
      (artifact) => artifact.artifactDigest === item.artifactDigest,
    ),
  )
  const displayed = Array.filter(scoped, (item) => item.mature)
  const verdictCases = Array.filter(
    input.rollout === "mixed" ? displayed : onServing,
    (item) => item.mature,
  )
  const supporting = Array.filter(
    displayed,
    (item) => item.business === "intended",
  )
  const contrary = Array.filter(
    displayed,
    (item) => item.business === "contrary",
  )
  const verdictContrary = Array.filter(
    verdictCases,
    (item) => item.business === "contrary",
  )
  const verdictSupporting = Array.filter(
    verdictCases,
    (item) => item.business === "intended",
  )
  const counterexample = Array.head(verdictContrary).pipe(
    Option.map((item) => bound(item)),
    Option.getOrElse(() => null),
  )
  const comparable =
    input.population === "known-compatible" &&
    input.rollout === "single" &&
    input.baseline === "present" &&
    input.maturity === "mature" &&
    !receiptCohort.rateWithheld
  const rate = comparable
    ? { supporting: verdictSupporting.length, observed: verdictCases.length }
    : null
  const examples = {
    supporting: Array.map(supporting, bound),
    contrary: Array.map(contrary, bound),
    counterexample,
    rate,
    causalClaim: false as const,
    follow,
  }
  const gate = Array.get(
    Array.getSomes([
      input.population === "incompatible-meaning"
        ? Option.some({
            status: "inconclusive" as const,
            reason: "incompatible-meaning" as const,
            repair: "none" as const,
          })
        : Option.none(),
      input.maturity !== "mature"
        ? Option.some({
            status: "waiting" as const,
            reason:
              input.maturity === "late"
                ? ("late-evidence" as const)
                : ("waiting-for-mature-traffic" as const),
            repair: "none" as const,
          })
        : Option.none(),
      input.rollout === "mixed"
        ? Option.some({
            status: "inconclusive" as const,
            reason: "mixed-rollout" as const,
            repair: "none" as const,
          })
        : Option.none(),
      input.population === "missing"
        ? Option.some({
            status: "inconclusive" as const,
            reason: "missing-population" as const,
            repair: "missing-observation" as const,
          })
        : Option.none(),
      verdictContrary.length > 0
        ? Option.some({
            status: "contrary" as const,
            reason: "contrary-case" as const,
            repair: "investigate" as const,
          })
        : Option.none(),
      verdictSupporting.length > 0
        ? Option.some({
            status: "supported" as const,
            reason:
              input.baseline === "absent"
                ? ("no-baseline" as const)
                : ("intended-outcome" as const),
            repair: "none" as const,
          })
        : Option.none(),
    ]),
    0,
  )
  const decided = gate.pipe(
    Option.getOrElse(() => ({
      status: "inconclusive" as const,
      reason: "no-observed-cases" as const,
      repair: "missing-observation" as const,
    })),
  )
  return { ...examples, ...decided, receiptCohort }
}
