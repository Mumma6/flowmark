import type { ReferenceJourneyEvidence } from "../types.js"
import { createHash } from "node:crypto"
import { Array, Effect, HashMap, HashSet, Option, pipe } from "effect"
import type {
  JourneyRunReference,
  ReferenceJourneyPage,
  ReferenceJourneyQuery,
} from "@flowmarkdev/core"
import { Database } from "../../database.js"
import { DatabaseOperation } from "../../database-operation.js"
import { runQuery } from "../../run-query.js"
import {
  journeyAnchorsSql,
  journeyEvidenceSql,
  journeyNeighborsSql,
} from "../sql/reference-journey.js"
import {
  invalidJourneySelection,
  readJourneyCursor,
} from "../reference-journey-cursor.js"
import {
  projectJourneyEdges,
  projectJourneyNode,
  type JourneyEvidenceRow,
} from "../journey-projection.js"

const MAX_NODES = 100
const MAX_DEPTH = 4
type Member = JourneyRunReference & { readonly depth: number }
interface Traversal {
  readonly nodes: readonly Member[]
  readonly frontier: readonly string[]
  readonly truncated: boolean
}

export const getReferenceJourney = Effect.fn("getReferenceJourney")(function* (
  projectId: string,
  query: ReferenceJourneyQuery,
) {
  const db = yield* Database
  const limit = Math.min(50, Math.max(1, query.limit ?? 25))
  const scope = [
    projectId,
    query.workflow,
    query.key,
    query.value,
    createHash("sha256").update(JSON.stringify(query.namespaces)).digest("hex"),
  ]
  const candidateCursor = yield* readJourneyCursor(query.candidateCursor)
  const cursor = yield* readJourneyCursor(query.cursor)
  if (
    candidateCursor &&
    (candidateCursor.kind !== "candidates" ||
      JSON.stringify(candidateCursor.scope) !== JSON.stringify(scope) ||
      query.anchorRunId ||
      cursor)
  ) {
    return yield* invalidJourneySelection()
  }
  if (candidateCursor?.kind === "candidates") {
    const [stored] = yield* runQuery(
      DatabaseOperation.ReadReferenceJourney,
      () =>
        db.execute<JourneyRunReference & Record<string, unknown>>(
          journeyAnchorsSql(
            projectId,
            { ...query, anchorRunId: candidateCursor.id },
            1,
          ),
        ),
    )
    if (!stored || stored.startedAt !== candidateCursor.startedAt) {
      return yield* invalidJourneySelection()
    }
  }
  const found = yield* runQuery(DatabaseOperation.ReadReferenceJourney, () =>
    db.execute<JourneyRunReference & Record<string, unknown>>(
      journeyAnchorsSql(
        projectId,
        query,
        limit + 1,
        candidateCursor?.kind === "candidates" ? candidateCursor : undefined,
      ),
    ),
  )
  const candidates = Array.take(found, limit)
  const moreCandidates = found.length > limit
  const anchor =
    query.anchorRunId || (!query.candidateCursor && found.length === 1)
      ? candidates[0]
      : undefined
  if (query.anchorRunId && !anchor) {
    return yield* invalidJourneySelection()
  }
  const base = {
    projectId,
    namespace: { workflow: query.workflow, key: query.key },
    value: query.value,
    namespaces: query.namespaces,
    candidates,
    nextCandidateCursor: moreCandidates
      ? JSON.stringify({
          kind: "candidates",
          scope,
          id: candidates.at(-1)!.id,
          startedAt: candidates.at(-1)!.startedAt,
        })
      : null,
    bounds: {
      maxDepth: MAX_DEPTH,
      maxNodes: MAX_NODES,
      pageLimit: limit,
      traversalTruncated: false,
      cycleDetected: false,
    },
    coverage:
      "Recorded linked evidence only; downstream sampling is not a complete funnel.",
  } as const
  if (!anchor) {
    if (cursor) {
      return yield* invalidJourneySelection()
    }
    const page: ReferenceJourneyPage = {
      ...base,
      state: found.length === 0 && !candidateCursor ? "NotFound" : "Ambiguous",
      anchorRunId: null,
      nodes: [],
      edges: [],
      nextCursor: null,
    }
    return {
      page,
      graph: { nodes: [], edges: [] },
    } satisfies ReferenceJourneyEvidence
  }
  const nodeScope = [...scope, anchor.id]
  if (
    cursor &&
    (cursor.kind !== "nodes" ||
      JSON.stringify(cursor.scope) !== JSON.stringify(nodeScope))
  ) {
    return yield* invalidJourneySelection()
  }
  const traverse = (state: Traversal, depth: number) => {
    if (state.frontier.length === 0 || state.truncated) {
      return Effect.succeed(state)
    }
    const remaining = MAX_NODES - state.nodes.length
    return runQuery(DatabaseOperation.ReadReferenceJourney, () =>
      db.execute<JourneyRunReference & Record<string, unknown>>(
        journeyNeighborsSql(
          projectId,
          query,
          state.frontier,
          Array.map(state.nodes, (node) => node.id),
          remaining + 1,
        ),
      ),
    ).pipe(
      Effect.map((rows): Traversal => {
        const next = Array.take(rows, remaining)
        return {
          nodes: [
            ...state.nodes,
            ...Array.map(next, (node) => ({ ...node, depth })),
          ],
          frontier: Array.map(next, (node) => node.id),
          truncated: rows.length > remaining,
        }
      }),
    )
  }
  const graph = yield* Effect.reduce(
    Array.range(1, MAX_DEPTH),
    () =>
      ({
        nodes: [{ ...anchor, depth: 0 }],
        frontier: [anchor.id],
        truncated: false,
      }) as Traversal,
    traverse,
  )
  const beyond =
    !graph.truncated && graph.frontier.length > 0
      ? yield* runQuery(DatabaseOperation.ReadReferenceJourney, () =>
          db.execute<JourneyRunReference & Record<string, unknown>>(
            journeyNeighborsSql(
              projectId,
              query,
              graph.frontier,
              Array.map(graph.nodes, (node) => node.id),
              1,
            ),
          ),
        )
      : []
  const rows = yield* runQuery(DatabaseOperation.ReadReferenceJourney, () =>
    db.execute<JourneyEvidenceRow & Record<string, unknown>>(
      journeyEvidenceSql(
        projectId,
        Array.map(graph.nodes, (node) => node.id),
      ),
    ),
  )
  const byId = HashMap.fromIterable(
    Array.map(rows, (row) => [row.id, row] as const),
  )
  const nodes = yield* Effect.forEach(graph.nodes, (node) =>
    Option.match(HashMap.get(byId, node.id), {
      onNone: () => Effect.fail(invalidJourneySelection()),
      onSome: (row) => Effect.succeed(projectJourneyNode(row, node.depth)),
    }),
  )
  const edges = projectJourneyEdges(rows)
  const position = cursor
    ? Option.getOrElse(
        Array.findFirstIndex(nodes, (node) => node.id === cursor.id),
        () => -1,
      )
    : -1
  if (cursor && position < 0) {
    return yield* invalidJourneySelection()
  }
  const page = pipe(nodes, Array.drop(position + 1), Array.take(limit))
  const pageIds = HashSet.fromIterable(Array.map(page, (node) => node.id))
  const result: ReferenceJourneyPage = {
    ...base,
    state: "Selected",
    anchorRunId: anchor.id,
    nodes: page,
    edges: Array.filter(edges, (edge) => HashSet.has(pageIds, edge.toRunId)),
    nextCursor:
      position + 1 + page.length < nodes.length
        ? JSON.stringify({
            kind: "nodes",
            scope: nodeScope,
            id: page.at(-1)!.id,
          })
        : null,
    bounds: {
      ...base.bounds,
      traversalTruncated: graph.truncated || beyond.length > 0,
    },
  }
  return {
    page: result,
    graph: { nodes: Array.map(nodes, (node) => node.id), edges },
  } satisfies ReferenceJourneyEvidence
})
