import type {
  DeployedArtifactMapping,
  RuntimeQuestionCheck,
  StoredRuntimeObservation,
  runtimeQuestionCases,
} from "@flowmarkdev/core"
import { Array, pipe } from "effect"

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
