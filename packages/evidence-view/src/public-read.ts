import { Data, Effect, Result } from "effect"
import { buildSuppliedRunSnapshot, type EvidenceSummary } from "./projection.js"
import { decodeSuppliedSnapshot } from "./snapshot.js"

/** Structural input port; the public client owns HTTP decoding and authorization. */
export interface PublicReadEvidence {
  readonly selection: {
    readonly projectId: string
    readonly runId: string
    readonly cursor?: string
  }
  readonly summary: EvidenceSummary
  readonly observedAt: string
  readonly page: {
    readonly events: readonly {
      readonly id: string
      readonly type: string
      readonly timestamp: string
    }[]
    readonly limit: number
    readonly totalEvents: number
    readonly nextCursor: string | null
  }
}

export class PortableReadEvidenceError extends Data.TaggedError(
  "PortableReadEvidenceError",
)<{
  readonly reason: "scope-mismatch" | "too-large" | "invalid-snapshot"
}> {}

/** Explicit consumer boundary: project authorized metadata, never spread the response. */
export const projectPublicReadEvidence = (response: PublicReadEvidence) =>
  Result.gen(function* () {
    const snapshot = buildSuppliedRunSnapshot(
      response.selection.projectId,
      response.summary,
      { ...response.page, runId: response.selection.runId },
      response.selection.cursor !== undefined,
    )
    if (snapshot === null) {
      return yield* Result.fail(
        new PortableReadEvidenceError({ reason: "scope-mismatch" }),
      )
    }
    const serialized = JSON.stringify(
      {
        ...snapshot,
        evidenceNote: `${snapshot.evidenceNote} Observed at ${response.observedAt}. This local copy does not refresh or recheck access.`,
      },
      null,
      2,
    )
    if (new TextEncoder().encode(serialized).byteLength > 65536) {
      return yield* Result.fail(
        new PortableReadEvidenceError({ reason: "too-large" }),
      )
    }
    yield* decodeSuppliedSnapshot(serialized).pipe(
      Result.mapError(
        () => new PortableReadEvidenceError({ reason: "invalid-snapshot" }),
      ),
    )
    return serialized
  })

/** Ordinary Promise boundary for a standalone CLI; credentials never enter this module. */
export const publicReadSnapshotJson = (
  response: PublicReadEvidence,
): Promise<string> =>
  Effect.sync(() => projectPublicReadEvidence(response)).pipe(
    Effect.flatMap(Effect.fromResult),
    Effect.runPromise,
  )
