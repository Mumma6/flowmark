import { Array, HashSet, Match } from "effect"
import type {
  JourneyEdge,
  JourneyNode,
  JourneyRunReference,
} from "@flowmarkdev/core"

export interface JourneyEvidenceRow extends JourneyRunReference {
  readonly status: JourneyNode["status"]
  readonly outcome: string | null
  readonly parentRunId: string | null
  readonly retryOf: { readonly workflow: string; readonly runId: string } | null
  readonly parents: readonly JourneyRunReference[]
  readonly retries: readonly JourneyRunReference[]
}
export const projectJourneyNode = (
  row: JourneyEvidenceRow,
  depth: number,
): JourneyNode => ({
  id: row.id,
  externalId: row.externalId,
  workflow: row.workflow,
  startedAt: row.startedAt,
  depth,
  status: row.status,
  outcome: row.outcome,
  parent: {
    state: Match.value({
      reported: row.parentRunId !== null,
      count: row.parents.length,
    }).pipe(
      Match.when({ reported: false }, () => "absent" as const),
      Match.when({ count: 0 }, () => "missing" as const),
      Match.when({ count: 1 }, () => "resolved" as const),
      Match.orElse(() => "ambiguous" as const),
    ),
    matches: row.parents,
  },
  retry: {
    state: Match.value({
      reported: row.retryOf !== null,
      count: row.retries.length,
    }).pipe(
      Match.when({ reported: false }, () => "absent" as const),
      Match.when({ count: 0 }, () => "missing" as const),
      Match.orElse(() => "resolved" as const),
    ),
    matches: row.retries,
  },
})
export const projectJourneyEdges = (
  rows: readonly JourneyEvidenceRow[],
): readonly JourneyEdge[] => {
  const members = HashSet.fromIterable(Array.map(rows, (row) => row.id))
  return Array.flatMap(rows, (row) =>
    Array.flatMap(
      [
        { kind: "parent" as const, matches: row.parents },
        { kind: "retry" as const, matches: row.retries },
      ],
      ({ kind, matches }) =>
        matches.length === 1
          ? [
              {
                fromRunId: matches[0]!.id,
                toRunId: row.id,
                kind,
                scope: HashSet.has(members, matches[0]!.id)
                  ? ("journey" as const)
                  : ("context" as const),
              },
            ]
          : [],
    ),
  )
}
