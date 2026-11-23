import { Array, Match, Option, Schema } from "effect"
import type { DeployedArtifactMapping } from "./artifact-manifest.js"

const Identifier = Schema.String.check(
  Schema.isPattern(/^[a-zA-Z0-9][a-zA-Z0-9._/-]{0,127}$/),
)
const Revision = Schema.String.check(
  Schema.isPattern(/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/),
)
const SourcePath = Schema.String.check(
  Schema.isMaxLength(512),
  Schema.isPattern(/^(?!\/)(?!.*(?:^|\/)\.{1,2}(?:\/|$))[^\\:\p{Cc}]+$/u),
)
const SymbolName = Schema.String.check(
  Schema.isMinLength(1),
  Schema.isMaxLength(256),
)
const ServiceName = Schema.String.check(
  Schema.isPattern(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/),
)

export const EvidenceBoundaryKindSchema = Schema.Literals([
  "request",
  "worker",
  "test",
  "domain-event",
  "compensation",
])
export type EvidenceBoundaryKind = typeof EvidenceBoundaryKindSchema.Type

export const EvidenceRuntimeSchema = Schema.Literals(["node", "next", "other"])
export const AttestingSignalSchema = Schema.Literals([
  "none",
  "outbox",
  "receipt",
  "existing-probe",
  "hook",
])
export type AttestingSignal = typeof AttestingSignalSchema.Type

export const SourceBoundarySchema = Schema.Struct({
  id: Identifier,
  kind: EvidenceBoundaryKindSchema,
  runtime: EvidenceRuntimeSchema,
  path: SourcePath,
  symbol: SymbolName,
  revision: Revision,
  attestingSignal: AttestingSignalSchema,
  consequence: Schema.Literals(["ordinary", "costly"]),
  frequency: Schema.Literals(["common", "rare"]),
  access: Schema.Literals(["readable", "partial", "inaccessible"]),
  generated: Schema.Boolean,
  policy: Schema.Literals(["included", "excluded"]),
  ambiguous: Schema.Boolean,
})
export type SourceBoundary = typeof SourceBoundarySchema.Type

export const DeployedBoundarySchema = Schema.Struct({
  id: Identifier,
  kind: EvidenceBoundaryKindSchema,
  runtime: EvidenceRuntimeSchema,
  path: Schema.optional(SourcePath),
  symbol: Schema.optional(SymbolName),
  revision: Revision,
  service: ServiceName,
  provenance: Schema.Literals(["deployment-manifest", "independent-inventory"]),
  generated: Schema.Boolean,
  ambiguous: Schema.Boolean,
})
export type DeployedBoundary = typeof DeployedBoundarySchema.Type

export const EvidenceEstateInputSchema = Schema.Struct({
  source: Schema.Array(SourceBoundarySchema).check(Schema.isMaxLength(24)),
  deployed: Schema.Array(DeployedBoundarySchema).check(Schema.isMaxLength(24)),
  previous: Schema.optional(
    Schema.Array(SourceBoundarySchema).check(Schema.isMaxLength(24)),
  ),
})
export type EvidenceEstateInput = typeof EvidenceEstateInputSchema.Type

export const EvidenceBoundaryStatusSchema = Schema.Literals([
  "matched",
  "source-only",
  "deployed-only",
  "unsupported",
  "policy-excluded",
])
export type EvidenceBoundaryStatus = typeof EvidenceBoundaryStatusSchema.Type

export type EvidenceBoundaryView = Readonly<{
  readonly id: string
  readonly kind: EvidenceBoundaryKind
  readonly status: EvidenceBoundaryStatus
  readonly provenance: readonly (
    "source-registration" | "deployment-manifest" | "independent-inventory"
  )[]
  readonly access: SourceBoundary["access"] | "deployed"
  readonly generated: boolean
  readonly ambiguous: boolean
  readonly attestingSignal: AttestingSignal | null
  readonly sufficientSignal: boolean
  readonly basis: "source-inference" | "deployment-inventory"
  readonly observedCases: null
  readonly rank: number
  readonly reason: string
  readonly revisionChange: "added" | "moved" | "unresolved" | "unchanged" | null
}>

export type EvidenceEstate = Readonly<{
  readonly boundaries: readonly EvidenceBoundaryView[]
  readonly revision: Readonly<{
    readonly compared: boolean
    readonly added: readonly string[]
    readonly moved: readonly string[]
    readonly unresolved: readonly string[]
  }>
  readonly telemetry: "not-read"
}>

export function boundariesFromArtifactMappings(
  mappings: readonly Pick<DeployedArtifactMapping, "service" | "manifest">[],
): readonly DeployedBoundary[] {
  return Array.flatMap(mappings, (mapping) =>
    Array.map(mapping.manifest.probes, (probe) => {
      const location = Match.value(probe.location).pipe(
        Match.when({ kind: "source" }, (site) => ({
          path: site.path,
          symbol: site.symbol,
          generated: false,
          ambiguous: false,
        })),
        Match.when({ kind: "generated" }, (site) => ({
          path: site.path,
          generated: true,
          ambiguous: false,
        })),
        Match.when({ kind: "ambiguous" }, () => ({
          generated: false,
          ambiguous: true,
        })),
        Match.exhaustive,
      )
      return {
        id: probe.probeId,
        kind: "request" as const,
        runtime: "node" as const,
        ...location,
        revision: mapping.manifest.revision,
        service: mapping.service,
        provenance: "deployment-manifest" as const,
      }
    }),
  )
}

const byId = <T extends { readonly id: string }>(
  items: readonly T[],
  id: string,
) => Array.findFirst(items, (item) => item.id === id)

const statusFor = (
  source: SourceBoundary,
  deployed: boolean,
): EvidenceBoundaryStatus =>
  Match.value({
    excluded: source.policy === "excluded",
    unsupported: source.runtime === "other",
    deployed,
  }).pipe(
    Match.when({ excluded: true }, () => "policy-excluded" as const),
    Match.when({ unsupported: true }, () => "unsupported" as const),
    Match.when({ deployed: true }, () => "matched" as const),
    Match.orElse(() => "source-only" as const),
  )

const signalReason = (signal: AttestingSignal) =>
  Match.value(signal).pipe(
    Match.when(
      "none",
      () => "No approved event or hook attests this fact yet.",
    ),
    Match.when(
      "outbox",
      () => "An existing outbox event can attest the committed fact.",
    ),
    Match.when(
      "receipt",
      () => "An existing receipt can attest the committed fact.",
    ),
    Match.when(
      "existing-probe",
      () => "An existing probe already attests this fact.",
    ),
    Match.when("hook", () => "An existing hook already attests this fact."),
    Match.exhaustive,
  )

const rankOf = (
  source: Pick<SourceBoundary, "kind" | "consequence" | "frequency">,
) =>
  (source.kind === "compensation" ? 4 : 0) +
  (source.consequence === "costly" ? 2 : 0) +
  (source.frequency === "rare" ? 1 : 0)

const revisionChange = (
  source: SourceBoundary,
  previous: readonly SourceBoundary[] | undefined,
  unresolved: boolean,
): EvidenceBoundaryView["revisionChange"] => {
  if (!previous) {
    return null
  }
  const prior = byId(previous, source.id)
  if (prior._tag === "None") {
    return unresolved ? "unresolved" : "added"
  }
  if (
    prior.value.path !== source.path ||
    prior.value.symbol !== source.symbol
  ) {
    return "moved"
  }
  return unresolved ? "unresolved" : "unchanged"
}

const dedupeDeployed = (deployed: readonly DeployedBoundary[]) =>
  Array.reduce(deployed, [] as DeployedBoundary[], (collected, entry) => {
    const existing = byId(collected, entry.id)
    if (existing._tag === "None") {
      return [...collected, entry]
    }
    return collected
  })

export function reconcileEvidenceBoundaries(
  input: EvidenceEstateInput,
): EvidenceEstate {
  const deployed = dedupeDeployed(input.deployed)
  const fromSource = Array.map(input.source, (source) => {
    const match = byId(deployed, source.id)
    const matched = match._tag === "Some"
    const status = statusFor(source, matched)
    const unresolved =
      source.ambiguous ||
      source.access === "inaccessible" ||
      status === "unsupported" ||
      status === "policy-excluded"
    const provenance = [
      "source-registration" as const,
      ...(matched ? [match.value.provenance] : []),
    ]
    const compensation =
      source.kind === "compensation" && source.consequence === "costly"
    return {
      id: source.id,
      kind: source.kind,
      status,
      provenance,
      access: source.access,
      generated: source.generated || (matched && match.value.generated),
      ambiguous: source.ambiguous || (matched && match.value.ambiguous),
      attestingSignal: source.attestingSignal,
      sufficientSignal:
        status === "matched" &&
        source.attestingSignal !== "none" &&
        !source.ambiguous &&
        source.access === "readable",
      basis: "source-inference" as const,
      observedCases: null,
      rank: rankOf(source),
      reason: compensation
        ? `${source.frequency === "rare" ? "Rare compensation boundary" : "Compensation boundary"}. A wrong decision is costly. ${signalReason(source.attestingSignal)} Source inference is not an observed case.`
        : `${signalReason(source.attestingSignal)} Source inference is not an observed case.`,
      revisionChange: revisionChange(source, input.previous, unresolved),
    } satisfies EvidenceBoundaryView
  })
  const fromDeployment = Array.getSomes(
    Array.map(deployed, (entry) =>
      byId(input.source, entry.id)._tag === "Some"
        ? Option.none<EvidenceBoundaryView>()
        : Option.some<EvidenceBoundaryView>({
            id: entry.id,
            kind: entry.kind,
            status: "deployed-only",
            provenance: [entry.provenance],
            access: "deployed",
            generated: entry.generated,
            ambiguous: entry.ambiguous,
            attestingSignal: null,
            sufficientSignal: false,
            basis: "deployment-inventory",
            observedCases: null,
            rank: 0,
            reason:
              "Present in the deployment inventory and absent from source registrations. No execution was read.",
            revisionChange: input.previous ? "unresolved" : null,
          }),
    ),
  )
  const boundaries = [...fromSource, ...fromDeployment].sort(
    (left, right) =>
      right.rank - left.rank ||
      (left.id < right.id ? -1 : left.id > right.id ? 1 : 0),
  )
  const listed = (change: EvidenceBoundaryView["revisionChange"]) =>
    Array.map(
      Array.filter(boundaries, (item) => item.revisionChange === change),
      (item) => item.id,
    )
  return {
    boundaries,
    revision: {
      compared: input.previous !== undefined,
      added: listed("added"),
      moved: listed("moved"),
      unresolved: listed("unresolved"),
    },
    telemetry: "not-read",
  }
}
