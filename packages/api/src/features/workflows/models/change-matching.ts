import type { DeployedArtifactMapping } from "@flowmarkdev/core"
import { Array } from "effect"

export type ChangeContext = {
  readonly ticket?: string
  readonly plan?: string
  readonly diff?: string
  readonly files?: readonly string[]
  readonly symbols?: readonly string[]
  readonly revision?: string
}

const commonWords = new Set([
  "about",
  "against",
  "behavior",
  "change",
  "code",
  "file",
  "fix",
  "from",
  "handle",
  "need",
  "that",
  "the",
  "this",
  "when",
  "with",
  "src",
  "index",
  "test",
  "tsx",
  "mjs",
  "cjs",
  "would",
])

const terms = (value: string) =>
  value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .match(/[a-z][a-z0-9]{2,}/g) ?? []

const byTerms = (value: string) =>
  new Set(terms(value).filter((term) => !commonWords.has(term)))

const diffPaths = (diff: string) => {
  const files = new Set<string>()
  const renamed = new Set<string>()
  const lines = diff.split(/\r?\n/)
  Array.forEach(lines, (line, index) => {
    if (line.startsWith("+++ b/")) {
      files.add(line.slice(6))
    }
    if (line.startsWith("rename to ")) {
      files.add(line.slice("rename to ".length))
      const previous = lines[index - 1]
      if (previous?.startsWith("rename from ")) {
        renamed.add(previous.slice("rename from ".length))
      }
    }
  })
  return { files, renamed }
}

type SourceMatch = {
  readonly score: number
  readonly reason: "file-and-symbol" | "file" | "symbol" | "rename" | "lexical"
  readonly terms: readonly string[]
}

type Source = { readonly path: string; readonly symbol?: string }
type Probe = DeployedArtifactMapping["manifest"]["probes"][number]

const matchSource = (
  probe: Probe,
  source: Source,
  search: {
    readonly files: ReadonlySet<string>
    readonly symbols: ReadonlySet<string>
    readonly renamed: ReadonlySet<string>
    readonly text: ReadonlySet<string>
  },
): readonly SourceMatch[] => {
  const file = search.files.has(source.path)
  const symbol =
    source.symbol !== undefined && search.symbols.has(source.symbol)
  if (file && symbol) {
    return [{ score: 100, reason: "file-and-symbol", terms: [] }]
  }
  if (file) {
    return [{ score: 90, reason: "file", terms: [] }]
  }
  if (symbol) {
    return [{ score: 80, reason: "symbol", terms: [] }]
  }
  if (search.renamed.has(source.path)) {
    return [{ score: 70, reason: "rename", terms: [] }]
  }
  const site = byTerms(
    `${source.path} ${source.symbol ?? ""} ${probe.behaviorId}`,
  )
  const shared = Array.fromIterable(search.text).filter((term) =>
    site.has(term),
  )
  return shared.length === 0
    ? []
    : [
        {
          score: Math.min(shared.length, 20),
          reason: "lexical",
          terms: shared.slice(0, 8),
        },
      ]
}

const sources = (probe: Probe): readonly Source[] =>
  probe.location.kind === "ambiguous"
    ? probe.location.candidates
    : [probe.location]

type MatchStrength = "exact" | "linked" | "adjacent" | "ambiguous"

/** Treat manifests as source mappings. A ranking cannot establish that a case ran. */
export function rankChangeMappings(
  change: ChangeContext,
  mappings: readonly DeployedArtifactMapping[],
) {
  const diff = diffPaths(change.diff ?? "")
  const files = new Set([...(change.files ?? []), ...diff.files])
  const search = {
    files,
    symbols: new Set(change.symbols ?? []),
    renamed: diff.renamed,
    text: byTerms(
      [
        change.ticket ?? "",
        change.plan ?? "",
        ...files,
        ...(change.symbols ?? []),
      ].join(" "),
    ),
  }
  const candidates = mappings
    .flatMap((deployment) =>
      deployment.manifest.probes.flatMap((probe) => {
        const best = sources(probe)
          .flatMap((source) => matchSource(probe, source, search))
          .sort((left, right) => right.score - left.score)[0]
        if (!best) {
          return []
        }
        const otherRevision =
          change.revision !== undefined &&
          change.revision !== deployment.manifest.revision
        let strength: MatchStrength = "exact"
        if (probe.location.kind !== "source") {
          strength = "ambiguous"
        } else if (otherRevision || best.reason === "lexical") {
          strength = "adjacent"
        } else if (best.reason === "rename") {
          strength = "linked"
        }
        return [
          {
            deployment,
            probe,
            ...best,
            strength,
            otherRevision,
            rank: best.score + (otherRevision ? 0 : 110),
          },
        ]
      }),
    )
    .sort((left, right) => right.rank - left.rank)
  const top = candidates[0]
  const tied =
    new Set(
      candidates
        .filter(({ rank }) => rank === top?.rank)
        .map(({ probe }) => probe.behaviorId),
    ).size > 1
  return {
    candidates: candidates.slice(0, 4).map((candidate) => ({
      ...candidate,
      strength:
        tied && candidate.rank === top?.rank
          ? ("ambiguous" as const)
          : candidate.strength,
    })),
    truncated: candidates.length > 4,
  }
}
