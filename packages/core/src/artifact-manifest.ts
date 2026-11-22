import { Array, Schema } from "effect"

const Identifier = Schema.String.check(
  Schema.isPattern(/^[a-zA-Z0-9][a-zA-Z0-9._/-]{0,127}$/),
)
const Digest = Schema.String.check(Schema.isPattern(/^sha256:[a-f0-9]{64}$/))
const SourcePath = Schema.String.check(
  Schema.isMaxLength(512),
  Schema.isPattern(/^(?!\/)(?!.*(?:^|\/)\.{1,2}(?:\/|$))[^\\:\p{Cc}]+$/u),
)
const Symbol = Schema.String.check(
  Schema.isMinLength(1),
  Schema.isMaxLength(256),
)
const SourceLocation = Schema.Struct({ path: SourcePath, symbol: Symbol })

const Probe = Schema.Struct({
  probeId: Identifier,
  behaviorId: Identifier,
  behaviorRevision: Identifier,
  location: Schema.Union([
    Schema.Struct({ kind: Schema.Literal("source"), ...SourceLocation.fields }),
    Schema.Struct({ kind: Schema.Literal("generated"), path: SourcePath }),
    Schema.Struct({
      kind: Schema.Literal("ambiguous"),
      candidates: Schema.Array(SourceLocation).check(
        Schema.isMinLength(2),
        Schema.isMaxLength(32),
      ),
    }),
  ]),
})

export const ArtifactManifestSchema = Schema.Struct({
  version: Schema.Literal(1),
  repository: Identifier,
  revision: Schema.String.check(
    Schema.isPattern(/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/),
  ),
  artifactDigest: Digest,
  probes: Schema.Array(Probe).check(Schema.isMaxLength(1024)),
}).check(
  Schema.makeFilter(
    ({ probes }) =>
      new Set(Array.map(probes, ({ probeId }) => probeId)).size ===
      probes.length,
  ),
)

export type ArtifactManifest = typeof ArtifactManifestSchema.Type

const compare = (left: string, right: string) =>
  left < right ? -1 : left > right ? 1 : 0

/** Probe and behavior identity are declared separately from their source locations. */
export function createArtifactManifest(input: unknown): ArtifactManifest {
  const manifest = Schema.decodeUnknownSync(ArtifactManifestSchema, {
    onExcessProperty: "error",
  })(input)

  return {
    ...manifest,
    probes: [...manifest.probes]
      .map((probe) => {
        if (probe.location.kind !== "ambiguous") {
          return probe
        }
        return {
          ...probe,
          location: {
            ...probe.location,
            candidates: [...probe.location.candidates].sort(
              (left, right) =>
                compare(left.path, right.path) ||
                compare(left.symbol, right.symbol),
            ),
          },
        }
      })
      .sort((left, right) => compare(left.probeId, right.probeId)),
  }
}

export type DeployedArtifactMapping = {
  readonly bindingId: string
  readonly deploymentId: string
  readonly environment: string
  readonly service: string
  readonly manifestDigest: string
  readonly manifest: ArtifactManifest
  readonly receivedAt: string
}

export type ArtifactMappingScope = {
  readonly repository: string
  readonly environment?: string
}
