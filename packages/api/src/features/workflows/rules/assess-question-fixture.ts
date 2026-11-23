import type {
  DeployedArtifactMapping,
  RuntimeQuestion,
  RuntimeQuestionCheck,
  StoredRuntimeObservation,
  runtimeQuestionCases,
} from "@flowmarkdev/core"
import { Array, Match, pipe } from "effect"

type FixtureCase = (typeof runtimeQuestionCases)[number]
type Status = "verified" | "missing" | "stale" | "failed" | "excluded"

export const fixtureReadiness = (
  status: Status,
  reason: string,
  fixtureCase?: FixtureCase,
) => {
  if (fixtureCase === undefined) {
    return { status, reason }
  }
  return { status, reason, fixtureCase }
}

export function verifyQuestionCase(
  input: RuntimeQuestionCheck,
  mapping: Pick<DeployedArtifactMapping, "manifestDigest" | "environment">,
  fixtureCase: FixtureCase,
  observations: ReadonlyArray<StoredRuntimeObservation>,
) {
  const { question } = input
  if (
    Array.some(observations, ({ observation }) => observation.kind === "loss")
  ) {
    return fixtureReadiness("failed", "reported-loss", fixtureCase)
  }
  if (
    Array.some(
      observations,
      ({ binding, observation }) =>
        !observation.probe || binding.status !== "bound",
    )
  ) {
    return fixtureReadiness("stale", "unbound-observation", fixtureCase)
  }
  const sites = Array.flatMap(observations, ({ binding, observation }) => {
    const probe = observation.probe
    if (
      binding.status !== "bound" ||
      observation.kind !== "observation" ||
      !probe
    ) {
      return []
    }
    if (
      probe.probeId !== question.requestProbe &&
      probe.probeId !== question.committedReceiptProbe
    ) {
      return []
    }
    return [{ binding, probe, references: observation.references }]
  })
  if (
    Array.some(
      sites,
      ({ binding, probe }) =>
        binding.manifestDigest !== mapping.manifestDigest ||
        binding.behaviorId !== question.behaviorId ||
        binding.behaviorRevision !== question.behaviorRevision ||
        binding.environment !== mapping.environment ||
        binding.revision !== input.sourceRevision ||
        probe.bindingId !== input.bindingId ||
        probe.deploymentId !== input.deploymentId ||
        probe.artifactDigest !== input.artifactDigest,
    )
  ) {
    return fixtureReadiness("stale", "observation-mapping-changed", fixtureCase)
  }
  if (
    fixtureCase === "rollback" &&
    Array.some(
      sites,
      ({ probe }) => probe.probeId === question.committedReceiptProbe,
    )
  ) {
    return fixtureReadiness(
      "failed",
      "commit-reported-on-rollback",
      fixtureCase,
    )
  }
  if (
    Array.some(sites, ({ references }) =>
      Array.some(
        references,
        (ref) =>
          ref.kind !== "change" ||
          !input.allowedChangeNamespaces.includes(ref.namespace),
      ),
    )
  ) {
    return fixtureReadiness(
      "failed",
      "field-outside-fixture-policy",
      fixtureCase,
    )
  }
  const links = Array.map(sites, ({ probe, references }) => ({
    site: probe.probeId,
    digests: pipe(
      references,
      Array.filter((ref) => ref.namespace === question.changeNamespace),
      Array.map((ref) => ref.digest),
    ),
  }))
  if (Array.some(links, (link) => link.digests.length === 0)) {
    return fixtureReadiness("missing", "missing-change-link", fixtureCase)
  }
  if (Array.some(links, (link) => link.digests.length > 1)) {
    return fixtureReadiness("failed", "ambiguous-change-link", fixtureCase)
  }
  const digestsAt = (site: string) => {
    return pipe(
      links,
      Array.filter((link) => link.site === site),
      Array.flatMap((link) => link.digests),
    )
  }
  const requests = digestsAt(question.requestProbe)
  const receipts = digestsAt(question.committedReceiptProbe)
  if (!requests.length || (fixtureCase !== "rollback" && !receipts.length)) {
    return fixtureReadiness("missing", "missing-observation", fixtureCase)
  }
  if (
    requests.length !== 1 ||
    (fixtureCase !== "rollback" && receipts.length !== 1)
  ) {
    return fixtureReadiness("failed", "ambiguous-observation", fixtureCase)
  }
  if (
    fixtureCase !== "rollback" &&
    (requests[0] === receipts[0]) !== (fixtureCase === "linked")
  ) {
    return fixtureReadiness("failed", "wrong-request-distinction", fixtureCase)
  }
  return fixtureReadiness("verified", "fixture-case-verified", fixtureCase)
}

export type QuestionDistinction = Readonly<
  | {
      readonly status: "observed"
      readonly distinction: "same-change" | "different-change"
      readonly reason: string
    }
  | { readonly status: "inconclusive"; readonly reason: string }
>

export const questionRecommendedAction = (reason: string) =>
  Match.value(reason).pipe(
    Match.when("missing-change-link", () => "add-minimal-change-link" as const),
    Match.when("missing-observation", () => "wait-or-add-observation" as const),
    Match.when("reported-loss", () => "escalate-capture-loss" as const),
    Match.whenOr(
      "observation-mapping-changed",
      "fixture-mapping-changed",
      "stale",
      () => "correct-source-mapping" as const,
    ),
    Match.whenOr(
      "ambiguous-observation",
      "ambiguous-change-link",
      () => "narrow-reporting-site" as const,
    ),
    Match.when(
      "field-outside-fixture-policy",
      () => "escalate-policy" as const,
    ),
    Match.when("unbound-observation", () => "wait-for-binding" as const),
    Match.orElse(() => "reuse-or-investigate" as const),
  )

/** Classify live observations against a supported runtime question. */
export function classifyQuestionDistinction(
  observations: ReadonlyArray<StoredRuntimeObservation>,
  question: RuntimeQuestion,
  input: Pick<
    RuntimeQuestionCheck,
    | "bindingId"
    | "deploymentId"
    | "artifactDigest"
    | "sourceRevision"
    | "allowedChangeNamespaces"
    | "environment"
  >,
  mapping: Pick<DeployedArtifactMapping, "manifestDigest" | "environment">,
): QuestionDistinction {
  const check: RuntimeQuestionCheck = {
    question,
    questionId: question.id,
    questionRevision: question.revision,
    fixture: question.fixture,
    allowedChangeNamespaces: input.allowedChangeNamespaces,
    environment: input.environment,
    bindingId: input.bindingId,
    deploymentId: input.deploymentId,
    artifactDigest: input.artifactDigest,
    sourceRevision: input.sourceRevision,
  }
  const linked = verifyQuestionCase(check, mapping, "linked", observations)
  if (linked.status === "verified") {
    return {
      status: "observed",
      distinction: "same-change",
      reason: linked.reason,
    }
  }
  const other = verifyQuestionCase(check, mapping, "otherRequest", observations)
  if (other.status === "verified") {
    return {
      status: "observed",
      distinction: "different-change",
      reason: other.reason,
    }
  }
  const reason =
    linked.status === "missing"
      ? linked.reason
      : other.status === "missing"
        ? other.reason
        : linked.reason
  return { status: "inconclusive", reason }
}
