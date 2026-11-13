import { Array, Effect, Match } from "effect"
import type {
  BusinessEvidenceQuery,
  BusinessPublication,
} from "@flowmarkdev/core"
import { InvalidInput } from "../../../errors.js"
import type { EvidenceAccess } from "../ports/business-evidence.js"
import {
  assertPublishedReference,
  publicationMeaning,
} from "../rules/publication.js"
import {
  projectBusinessFields,
  projectBusinessReferences,
  projectBusinessSummary,
} from "../rules/project-run.js"
import {
  queryFingerprint,
  decodeBusinessCursor,
  encodeBusinessCursor,
} from "../rules/cursor.js"
export const readBusinessData = Effect.fn("readBusinessData")(function* (
  projectId: string,
  access: EvidenceAccess,
  publication: BusinessPublication,
  input: BusinessEvidenceQuery,
) {
  const meaning = yield* Effect.cached(
    access
      .choices()
      .pipe(Effect.map((choices) => publicationMeaning(publication, choices))),
  )
  const assertReference = (workflow: string | undefined, key: string) =>
    meaning.pipe(
      Effect.flatMap((value) =>
        assertPublishedReference(
          { results: [], references: value.references },
          workflow,
          key,
        ),
      ),
    )
  return yield* Match.value(input).pipe(
    Match.when({ kind: "overview" }, ({ workflow, revision }) =>
      Effect.gen(function* () {
        const workflows = yield* access.workflows(workflow)
        const published = yield* meaning
        return {
          kind: "overview" as const,
          workflows: Array.map(Array.take(workflows, 100), (w) => ({
            name: w.name,
            runs: w.runs,
            completedPercent: w.completedPercent,
            medianDurationMs: w.medianDurationMs,
            p95DurationMs: w.p95DurationMs,
          })),
          continued: workflows.length > 100,
          meaning: {
            results: Array.filter(
              published.results,
              (e) =>
                (workflow === undefined || e.workflow === workflow) &&
                (revision === undefined || e.revision === revision),
            ),
            references: Array.filter(
              published.references,
              (e) => workflow === undefined || e.workflow === workflow,
            ),
          },
        }
      }),
    ),
    Match.when({ kind: "runs" }, ({ query }) =>
      Effect.gen(function* () {
        if (query.businessKey !== undefined) {
          yield* assertReference(query.workflow, query.businessKey)
        }
        const { cursor, ...selection } = query
        const fingerprint = queryFingerprint({ kind: "runs", ...selection })
        const inner = yield* decodeBusinessCursor(
          cursor,
          projectId,
          access.revision,
          fingerprint,
        )
        // The legacy cursor is a timestamp/UUID pair, never an arbitrary SQL boundary.
        if (
          inner !== undefined &&
          !/^\d{4}-\d{2}-\d{2}[^|]*\|[a-f0-9-]{36}$/i.test(inner)
        ) {
          return yield* new InvalidInput({
            cause: "Invalid projected evidence cursor.",
          })
        }
        const page = yield* access.runs({ ...selection, cursor: inner })
        return {
          kind: "runs" as const,
          runs: Array.map(page.runs, projectBusinessSummary),
          total: page.total,
          limit: page.limit,
          nextCursor: encodeBusinessCursor(
            projectId,
            access.revision,
            fingerprint,
            page.nextCursor,
          ),
        }
      }),
    ),
    Match.when({ kind: "run" }, ({ runId }) =>
      Effect.gen(function* () {
        const run = yield* access.run(runId)
        if (!run) {
          return yield* new InvalidInput({
            cause: "Run not found in this project.",
          })
        }
        const published = yield* meaning
        return {
          kind: "run" as const,
          summary: projectBusinessSummary(run),
          fields: projectBusinessFields(run, published),
          references: projectBusinessReferences(
            run.workflow,
            run.properties,
            published,
          ),
        }
      }),
    ),
    Match.when({ kind: "journey" }, ({ query }) =>
      Effect.gen(function* () {
        yield* assertReference(query.workflow, query.key)
        yield* Effect.forEach(query.namespaces, (n) =>
          assertReference(n.workflow, n.key),
        )
        const { cursor, candidateCursor, ...selection } = query
        const fingerprint = queryFingerprint({ kind: "journey", ...selection })
        const inner = yield* decodeBusinessCursor(
          cursor,
          projectId,
          access.revision,
          fingerprint + ":nodes",
        )
        const candidates = yield* decodeBusinessCursor(
          candidateCursor,
          projectId,
          access.revision,
          fingerprint + ":candidates",
        )
        const page = yield* access.journey({
          ...selection,
          cursor: inner,
          candidateCursor: candidates,
        })
        return {
          kind: "journey" as const,
          state: page.state,
          namespace: {
            workflow: page.namespace.workflow,
            key: page.namespace.key,
          },
          value: page.value,
          candidates: Array.map(page.candidates, (c) => ({
            id: c.id,
            workflow: c.workflow,
            startedAt: c.startedAt,
          })),
          nodes: Array.map(page.nodes, (n) => ({
            id: n.id,
            workflow: n.workflow,
            startedAt: n.startedAt,
            status: n.status,
            outcome: n.outcome,
            depth: n.depth,
          })),
          edges: Array.map(page.edges, (e) => ({
            fromRunId: e.fromRunId,
            toRunId: e.toRunId,
            kind: e.kind,
            scope: e.scope,
          })),
          nextCursor: encodeBusinessCursor(
            projectId,
            access.revision,
            fingerprint + ":nodes",
            page.nextCursor,
          ),
          nextCandidateCursor: encodeBusinessCursor(
            projectId,
            access.revision,
            fingerprint + ":candidates",
            page.nextCandidateCursor,
          ),
          anchorRunId: page.anchorRunId,
          bounds: page.bounds,
          coverage: page.coverage,
        }
      }),
    ),
    Match.when({ kind: "insights" }, ({ query }) =>
      Effect.gen(function* () {
        if (query.releaseA !== undefined || query.releaseB !== undefined) {
          return yield* new InvalidInput({
            cause: "Release filters are withheld from business evidence.",
          })
        }
        if (query.businessKey !== undefined) {
          yield* assertReference(query.workflow, query.businessKey)
        }
        const published = yield* meaning
        yield* Effect.forEach(
          [
            query.path,
            ...(query.numerator ? [query.numerator] : []),
            ...(query.denominator ? [query.denominator] : []),
          ],
          (path) =>
            Array.some(
              published.results,
              (e) =>
                e.workflow === query.workflow &&
                e.revision === query.revision &&
                Array.some(
                  e.fields,
                  (f) =>
                    JSON.stringify(f.path) === JSON.stringify(path) &&
                    f.aggregate,
                ),
            )
              ? Effect.void
              : Effect.fail(
                  new InvalidInput({
                    cause:
                      "This result selector is withheld from business evidence.",
                  }),
                ),
        )
        const report = yield* access.insights(query)
        // Construct the supported aggregate DTO; no diagnostic extensions flow through.
        return {
          kind: "insights" as const,
          report: {
            query,
            field: {
              path: report.field.path,
              label: report.field.label,
              kind: report.field.kind,
              ...(report.field.unit === undefined
                ? {}
                : { unit: report.field.unit }),
            },
            windows: Array.map(report.windows, (w) => ({
              scope: w.scope,
              totalRuns: w.totalRuns,
              finishedRuns: w.finishedRuns,
              failedRuns: w.failedRuns,
              openRuns: w.openRuns,
              incompatibleRevision: w.incompatibleRevision,
              missingResult: w.missingResult,
              missingField: w.missingField,
              wrongType: w.wrongType,
              unknownCategory: w.unknownCategory,
              knownRuns: w.knownRuns,
              total: w.total,
              missingOutcome: w.missingOutcome,
              otherOutcomeRuns: w.otherOutcomeRuns,
              outcomes: Array.map(w.outcomes, (o) => ({
                value: o.value,
                runs: o.runs,
              })),
              categories: Array.map(w.categories, (c) => ({
                value: c.value,
                runs: c.runs,
                total: c.total,
              })),
              daily: Array.map(w.daily, (d) => ({
                date: d.date,
                finishedRuns: d.finishedRuns,
                knownRuns: d.knownRuns,
                total: d.total,
              })),
              ratio: {
                knownRuns: w.ratio.knownRuns,
                numerator: w.ratio.numerator,
                denominator: w.ratio.denominator,
                value: w.ratio.value,
              },
            })),
            releaseComparison: {
              available: false,
              reason: "Release diagnostics are withheld.",
              minimumRuns: report.releaseComparison.minimumRuns,
            },
          },
        }
      }),
    ),
    Match.when({ kind: "compare" }, ({ runId, days }) =>
      Effect.gen(function* () {
        const comparison = yield* access.compare(runId, days ?? 30)
        return {
          kind: "compare" as const,
          current: comparison.current
            ? projectBusinessSummary(comparison.current)
            : null,
          peers: Array.map(comparison.peers, projectBusinessSummary),
          completedPercent: comparison.peerSuccessRate,
          medianDurationMs: comparison.peerMedianDurationMs,
          p95DurationMs: comparison.peerP95DurationMs,
          days: days ?? 30,
          minimumSample: comparison.population?.minimumSample ?? 5,
          eligible: comparison.population?.eligible ?? comparison.peers.length,
          selected: comparison.peers.length,
        }
      }),
    ),
    Match.exhaustive,
  )
})
