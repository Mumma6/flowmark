import { sql } from "drizzle-orm"
import { PeerSelectionSchema, type PeerSelection } from "@flowmarkdev/core"
import { Schema } from "effect"
import { getSearchFields } from "../../result-declarations/queries/get-search-fields.js"
import { Effect } from "effect"
import { Database, InvalidResultQuery } from "../../database.js"
import { DatabaseOperation } from "../../database-operation.js"
import { runQuery } from "../../run-query.js"
import { currentRunSql, peerRunsSql } from "../sql/run-summaries.js"
import { getOperationFacts } from "./get-operation-facts.js"
import type { OperationCompareRow, RunComparison, StoredRun } from "../types.js"

const percentile = (values: readonly number[], p: number) => {
  if (values.length === 0) {
    return null
  }
  const sorted = [...values].sort((left, right) => left - right)
  const index = (sorted.length - 1) * p
  const low = Math.floor(index)
  const high = Math.ceil(index)
  const lower = sorted[low]
  if (lower === undefined) {
    return null
  }
  const upper = sorted[high]
  if (upper === undefined || low === high) {
    return lower
  }
  return lower + (upper - lower) * (index - low)
}

export type OpSummary = {
  readonly occurrenceCount: number
  readonly openCount: number
  readonly failedCount: number
  readonly medianDurationMs: number | null
  readonly totalRecordedDurationMs: number | null
  readonly name: string
  readonly durationMs: number | null
  readonly status: "completed" | "failed" | "open"
}

export function operationSummaries(
  events: ReadonlyArray<{
    readonly type: string
    readonly operationId: string | null
    readonly operationName: string | null
    readonly durationMs: number | null
    readonly timestamp: string
  }>,
): ReadonlyArray<OpSummary> {
  const byId = new Map<
    string,
    {
      name: string
      durationMs: number | null
      status: "completed" | "failed" | "open"
      startedAt: string
    }
  >()
  for (const event of events) {
    const id = event.operationId
    if (!id) {
      continue
    }
    if (event.type === "operation_started") {
      if (byId.has(id)) {
        continue
      }
      byId.set(id, {
        name: event.operationName ?? "Operation",
        durationMs: null,
        status: "open",
        startedAt: event.timestamp,
      })
    } else if (
      event.type === "operation_completed" ||
      event.type === "operation_failed"
    ) {
      const existing = byId.get(id)
      byId.set(id, {
        ...(existing ?? {
          name: event.operationName ?? "Operation",
          startedAt: event.timestamp,
        }),
        durationMs: event.durationMs,
        status: event.type === "operation_failed" ? "failed" : "completed",
      })
    }
  }
  const groups = new Map<
    string,
    Array<typeof byId extends Map<string, infer V> ? V : never>
  >()
  for (const occurrence of byId.values()) {
    const group = groups.get(occurrence.name) ?? []
    group.push(occurrence)
    groups.set(occurrence.name, group)
  }
  return [...groups].map(([name, occurrences]) => {
    const durations = occurrences.flatMap((item) =>
      item.durationMs === null ? [] : [item.durationMs],
    )
    return {
      name,
      occurrenceCount: occurrences.length,
      openCount: occurrences.filter((item) => item.status === "open").length,
      failedCount: occurrences.filter((item) => item.status === "failed")
        .length,
      medianDurationMs: percentile(durations, 0.5),
      totalRecordedDurationMs: durations.length
        ? durations.reduce((sum, value) => sum + value, 0)
        : null,
      // Preserve the existing longest-occurrence field for old readers.
      durationMs: durations.length
        ? durations.reduce(
            (longest, duration) => Math.max(longest, duration),
            0,
          )
        : null,
      status: occurrences.some((item) => item.status === "failed")
        ? ("failed" as const)
        : occurrences.some((item) => item.status === "open")
          ? ("open" as const)
          : ("completed" as const),
    }
  })
}

function buildOperationCompare(
  current: ReadonlyArray<OpSummary>,
  peers: ReadonlyArray<{
    readonly runId: string
    readonly operations: ReadonlyArray<OpSummary>
  }>,
): ReadonlyArray<OperationCompareRow> {
  const names = new Set<string>([
    ...current.map((item) => item.name),
    ...peers.flatMap(({ operations }) => operations.map((item) => item.name)),
  ])
  return [...names]
    .sort((left, right) => left.localeCompare(right))
    .slice(0, 100)
    .map((name) => {
      const currentOp = current.find((item) => item.name === name)
      const peerDurations = peers.flatMap(({ operations }) => {
        const match = operations.find((item) => item.name === name)
        return match?.durationMs == null ? [] : [match.durationMs]
      })
      const peerRunIds = peers
        .filter(({ operations }) =>
          operations.some((item) => item.name === name),
        )
        .map(({ runId }) => runId)
      return {
        name,
        currentDurationMs: currentOp?.durationMs ?? null,
        currentOccurrenceCount: currentOp?.occurrenceCount ?? 0,
        currentOpenCount: currentOp?.openCount ?? 0,
        currentFailedCount: currentOp?.failedCount ?? 0,
        currentMedianOccurrenceDurationMs: currentOp?.medianDurationMs ?? null,
        currentTotalRecordedDurationMs:
          currentOp?.totalRecordedDurationMs ?? null,
        currentStatus: currentOp?.status ?? "absent",
        peerMedianDurationMs: percentile(peerDurations, 0.5),
        peerMedianOccurrenceDurationMs: percentile(
          peers.flatMap(({ operations }) => {
            const value = operations.find(
              (item) => item.name === name,
            )?.medianDurationMs
            return value == null ? [] : [value]
          }),
          0.5,
        ),
        peerMedianTotalRecordedDurationMs: percentile(
          peers.flatMap(({ operations }) => {
            const value = operations.find(
              (item) => item.name === name,
            )?.totalRecordedDurationMs
            return value == null ? [] : [value]
          }),
          0.5,
        ),
        peerOpenRunCount: peers.filter(({ operations }) =>
          operations.some((item) => item.name === name && item.openCount > 0),
        ).length,
        peerFailedRunCount: peers.filter(({ operations }) =>
          operations.some((item) => item.name === name && item.failedCount > 0),
        ).length,
        peerPresentCount: peers.filter((list) =>
          list.operations.some((item) => item.name === name),
        ).length,
        peerRunIds,
      }
    })
}

const emptyComparison: RunComparison = {
  current: null,
  peers: [],
  peerSuccessRate: null,
  peerMedianDurationMs: null,
  peerP95DurationMs: null,
  operations: [],
}

export const getRunComparison = Effect.fn("getRunComparison")(function* (
  projectId: string,
  runId: string,
  input: PeerSelection = {},
) {
  const selection = yield* Schema.decodeUnknownEffect(PeerSelectionSchema)(
    input,
  ).pipe(
    Effect.mapError(
      () => new InvalidResultQuery({ message: "Invalid peer selection." }),
    ),
  )
  const db = yield* Database
  const [current] = yield* runQuery(DatabaseOperation.ReadRun, () =>
    db.execute<StoredRun>(currentRunSql(projectId, runId)),
  )
  if (!current) {
    return emptyComparison
  }
  if (selection.dimensionKey !== undefined) {
    const fields = yield* getSearchFields(projectId, current.workflow)
    if (
      !fields.some(
        (field) =>
          field.role === "dimension" &&
          field.key === selection.dimensionKey &&
          field.values.includes(selection.dimensionValue ?? ""),
      )
    ) {
      return yield* new InvalidResultQuery({
        message: "Select a configured bounded dimension.",
      })
    }
  }
  const selected = yield* runQuery(DatabaseOperation.ReadPeerRuns, () =>
    db.execute<{
      id: string
      eligible: number
      environment: string | null
      release: string | null
    }>(peerRunsSql(projectId, runId, selection)),
  )
  const peerList = yield* Effect.forEach(
    Array.from(selected),
    (peer) =>
      runQuery(DatabaseOperation.ReadRun, () =>
        db.execute<StoredRun>(currentRunSql(projectId, peer.id)),
      ).pipe(Effect.map((rows) => rows[0])),
    { concurrency: 4 },
  )
  const finished = peerList.filter((run) => run.status !== "Running")
  const durations = peerList.flatMap((run) =>
    run.durationMs == null ? [] : [run.durationMs],
  )
  const completed = finished.filter((run) => run.status === "Completed").length
  const currentTimeline = yield* getOperationFacts(projectId, runId)
  const [metadata] = yield* runQuery(DatabaseOperation.ReadRun, () =>
    db.execute<{ environment: string | null; release: string | null }>(sql`
      SELECT r.environment, r.release FROM workflow_runs r JOIN workflows w ON w.id = r.workflow_id
      WHERE r.id = ${runId}::uuid AND w.project_id = ${projectId}
    `),
  )
  const peerTimelines = yield* Effect.forEach(
    peerList,
    (peer) =>
      getOperationFacts(projectId, peer.id).pipe(
        Effect.map((timeline) => ({
          runId: peer.id,
          operations: operationSummaries(timeline),
        })),
      ),
    { concurrency: 4 },
  )
  const operations = buildOperationCompare(
    operationSummaries(currentTimeline),
    peerTimelines,
  )
  return {
    population: {
      eligible: selected[0]?.eligible ?? 0,
      selected: peerList.length,
      durationObservations: durations.length,
      minimumSample: 5,
      days: selection.days ?? 30,
      environment: selected[0]?.environment ?? metadata?.environment ?? null,
      allEnvironments: selection.environment === "all",
      sameRelease: selection.sameRelease ?? false,
      release: metadata?.release ?? null,
    },
    current,
    peers: peerList,
    peerSuccessRate:
      finished.length === 0
        ? null
        : Math.round((1000 * completed) / finished.length) / 10,
    peerMedianDurationMs: percentile(durations, 0.5),
    peerP95DurationMs: percentile(durations, 0.95),
    operations,
  } satisfies RunComparison
})
