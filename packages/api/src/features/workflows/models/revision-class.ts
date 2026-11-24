import type {
  ArtifactManifest,
  DeployedArtifactMapping,
} from "@flowmarkdev/core"
import { Array, Match } from "effect"
import { diffTouchesPaths } from "./change-matching.js"

export const revisionClasses = [
  "reported-current",
  "historical",
  "diff-affected",
  "mapping-uncertain",
] as const

export type RevisionClass = (typeof revisionClasses)[number]

export type ObservedCaseClass = {
  readonly revisionClasses: readonly RevisionClass[]
  readonly behaviorClaim: "reported-deployment" | null
}

type Probe = ArtifactManifest["probes"][number]
type MatchReason = "file-and-symbol" | "file" | "symbol" | "rename" | "lexical"

const probePaths = (probe: Probe): readonly string[] =>
  Match.value(probe.location).pipe(
    Match.when({ kind: "source" }, (location) => [location.path]),
    Match.when({ kind: "generated" }, (location) => [location.path]),
    Match.when({ kind: "ambiguous" }, (location) =>
      location.candidates.map((candidate) => candidate.path),
    ),
    Match.exhaustive,
  )

const latestArrival = (
  deployment: DeployedArtifactMapping,
  mappings: readonly DeployedArtifactMapping[],
) => {
  const peers = Array.filter(
    mappings,
    (item) =>
      item.bindingId === deployment.bindingId &&
      item.environment === deployment.environment,
  )
  return Array.reduce(peers, deployment.receivedAt, (latest, item) =>
    item.receivedAt > latest ? item.receivedAt : latest,
  )
}

const claim = (classes: readonly RevisionClass[]): ObservedCaseClass => ({
  revisionClasses: classes,
  behaviorClaim:
    classes.includes("reported-current") &&
    !classes.includes("mapping-uncertain")
      ? "reported-deployment"
      : null,
})

/** Label one observed case. A receipt is an arrival record, not a serving interval. */
export function classifyObservedCase(input: {
  readonly deployment: DeployedArtifactMapping
  readonly probe: Probe
  readonly mappings: readonly DeployedArtifactMapping[]
  readonly diff?: string
  readonly matchReason: MatchReason
  readonly strength?: "exact" | "linked" | "adjacent" | "ambiguous"
  readonly otherRevision: boolean
}): ObservedCaseClass {
  const current =
    input.deployment.receivedAt ===
    latestArrival(input.deployment, input.mappings)
  const touched =
    input.diff !== undefined &&
    input.diff.length > 0 &&
    diffTouchesPaths(input.diff, probePaths(input.probe))
  const uncertain =
    input.probe.location.kind !== "source" ||
    input.matchReason === "lexical" ||
    input.strength === "ambiguous" ||
    input.otherRevision
  return claim(
    [
      current ? ("reported-current" as const) : ("historical" as const),
      touched ? ("diff-affected" as const) : undefined,
      uncertain ? ("mapping-uncertain" as const) : undefined,
    ].filter((item): item is RevisionClass => item !== undefined),
  )
}

export function classifyQuestionEvidence(input: {
  readonly deployment: DeployedArtifactMapping
  readonly mappings: readonly DeployedArtifactMapping[]
  readonly probeIds: readonly string[]
  readonly diff?: string
  readonly requestedRevision?: string
}): ObservedCaseClass {
  const probes = Array.filter(input.deployment.manifest.probes, (probe) =>
    input.probeIds.includes(probe.probeId),
  )
  const missing = probes.length !== input.probeIds.length
  const current =
    input.deployment.receivedAt ===
    latestArrival(input.deployment, input.mappings)
  const touched =
    input.diff !== undefined &&
    input.diff.length > 0 &&
    Array.some(probes, (probe) =>
      diffTouchesPaths(input.diff ?? "", probePaths(probe)),
    )
  const uncertain =
    missing ||
    Array.some(probes, (probe) => probe.location.kind !== "source") ||
    (input.requestedRevision !== undefined &&
      input.requestedRevision !== input.deployment.manifest.revision)
  return claim(
    [
      current ? ("reported-current" as const) : ("historical" as const),
      touched ? ("diff-affected" as const) : undefined,
      uncertain ? ("mapping-uncertain" as const) : undefined,
    ].filter((item): item is RevisionClass => item !== undefined),
  )
}

export function revisionClassNote(scanTruncated: boolean): string {
  const reported =
    "reported-current is the latest accepted deployment receipt for that binding and environment. It is a reported deployment, not a serving interval."
  return scanTruncated
    ? `${reported} The receipt scan is truncated, so reported-current versus historical may be incomplete.`
    : reported
}
