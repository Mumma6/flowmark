import type {
  DeployedArtifactMapping,
  RuntimeQuestion,
  RuntimeQuestionCheck,
  StoredRuntimeObservation,
  confirmationQuestionCases,
  runtimeQuestionCases,
} from "@flowmarkdev/core"
import { questionProbeIds } from "@flowmarkdev/core"
import { Array, Match, Option, pipe } from "effect"

type FixtureCase =
  | (typeof runtimeQuestionCases)[number]
  | (typeof confirmationQuestionCases)[number]
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
  const [firstProbe, secondProbe] = questionProbeIds(question)
  const sites = Array.getSomes(
    Array.map(observations, ({ binding, observation }, index) => {
      const probe = observation.probe
      if (
        binding.status !== "bound" ||
        observation.kind !== "observation" ||
        !probe ||
        (probe.probeId !== firstProbe && probe.probeId !== secondProbe)
      ) {
        return Option.none()
      }
      return Option.some({
        index,
        binding,
        probe,
        references: observation.references,
      })
    }),
  )
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
  if (question.predicate === "confirmation-for-same-change") {
    return verifyConfirmationCase(
      question,
      fixtureCase,
      sites,
      input.allowedChangeNamespaces,
    )
  }
  if (
    fixtureCase === "rollback" &&
    Array.some(sites, ({ probe }) => probe.probeId === secondProbe)
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
  const requests = digestsAt(firstProbe)
  const receipts = digestsAt(secondProbe)
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

type ObservationReferences = Extract<
  StoredRuntimeObservation["observation"],
  { kind: "observation" }
>["references"]

const changeDigests = (
  references: ObservationReferences,
  namespace: string,
  allowed: readonly string[],
) => {
  const changes = Array.filter(references, (ref) => ref.kind === "change")
  if (Array.some(changes, (ref) => !allowed.includes(ref.namespace))) {
    return { rejected: true as const, digests: [] as readonly string[] }
  }
  return {
    rejected: false as const,
    digests: pipe(
      changes,
      Array.filter((ref) => ref.namespace === namespace),
      Array.map((ref) => ref.digest),
    ),
  }
}

function verifyConfirmationCase(
  question: Extract<
    RuntimeQuestion,
    { predicate: "confirmation-for-same-change" }
  >,
  fixtureCase: FixtureCase,
  sites: ReadonlyArray<{
    readonly index: number
    readonly probe: { readonly probeId: string }
    readonly references: ObservationReferences
  }>,
  allowed: readonly string[],
) {
  const attempts = Array.getSomes(
    Array.map(sites, (site) =>
      site.probe.probeId === question.attemptProbe
        ? Option.some(site)
        : Option.none(),
    ),
  )
  const confirmations = Array.getSomes(
    Array.map(sites, (site) =>
      site.probe.probeId === question.confirmationProbe
        ? Option.some(site)
        : Option.none(),
    ),
  )
  const collected = Array.map(confirmations, (site) =>
    changeDigests(site.references, question.changeNamespace, allowed),
  )
  if (Array.some(collected, (item) => item.rejected)) {
    return fixtureReadiness(
      "failed",
      "field-outside-fixture-policy",
      fixtureCase,
    )
  }
  const attemptCollected = Array.map(attempts, (site) =>
    changeDigests(site.references, question.changeNamespace, allowed),
  )
  if (Array.some(attemptCollected, (item) => item.rejected)) {
    return fixtureReadiness(
      "failed",
      "field-outside-fixture-policy",
      fixtureCase,
    )
  }
  if (confirmations.length === 0) {
    return fixtureReadiness("missing", "missing-observation", fixtureCase)
  }
  const confirmationDigests = Array.dedupe(
    Array.flatMap(collected, (item) => item.digests),
  )
  if (confirmationDigests.length === 0) {
    return fixtureCase === "unlinked"
      ? fixtureReadiness("verified", "unlinked-confirmation", fixtureCase)
      : fixtureReadiness("missing", "missing-change-link", fixtureCase)
  }
  if (attempts.length === 0) {
    return fixtureReadiness("missing", "missing-observation", fixtureCase)
  }
  const attemptDigests = Array.dedupe(
    Array.flatMap(attemptCollected, (item) => item.digests),
  )
  if (attemptDigests.length !== 1 || confirmationDigests.length !== 1) {
    return fixtureReadiness("failed", "ambiguous-change-link", fixtureCase)
  }
  const attemptAt = Array.reduce(attempts, -1, (latest, site) =>
    site.index > latest ? site.index : latest,
  )
  const laterConfirmations = Array.getSomes(
    Array.map(confirmations, (site) =>
      site.index > attemptAt ? Option.some(site) : Option.none(),
    ),
  )
  const laterDigests = Array.dedupe(
    Array.flatMap(
      laterConfirmations,
      (site) =>
        changeDigests(site.references, question.changeNamespace, allowed)
          .digests,
    ),
  )
  if (laterDigests.length !== 1) {
    return fixtureReadiness("missing", "missing-change-link", fixtureCase)
  }
  const sameChange = laterDigests[0] === attemptDigests[0]
  if (fixtureCase === "unlinked" || sameChange !== (fixtureCase === "linked")) {
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
  const check = {
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
  } as RuntimeQuestionCheck
  if (question.predicate === "confirmation-for-same-change") {
    const linked = verifyQuestionCase(check, mapping, "linked", observations)
    if (linked.status === "verified") {
      return {
        status: "observed",
        distinction: "same-change",
        reason: linked.reason,
      }
    }
    const other = verifyQuestionCase(
      check,
      mapping,
      "otherChange",
      observations,
    )
    if (other.status === "verified") {
      return {
        status: "observed",
        distinction: "different-change",
        reason: other.reason,
      }
    }
    return { status: "inconclusive", reason: linked.reason }
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
