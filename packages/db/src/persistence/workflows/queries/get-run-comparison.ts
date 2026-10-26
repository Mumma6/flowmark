import { Effect } from "effect"
import { Database } from "../../database.js"
import { DatabaseOperation } from "../../database-operation.js"
import { runQuery } from "../../run-query.js"
import { currentRunSql, peerRunsSql } from "../sql/run-summaries.js"
import { getRunTimeline } from "./get-run-timeline.js"
import type {
  OperationCompareRow,
  RunComparison,
  StoredRun,
} from "../types.js"

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

type OpSummary = {
  readonly name: string
  readonly durationMs: number | null
  readonly status: "completed" | "failed" | "open"
}

function operationSummaries(
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
      byId.set(id, {
        name: event.operationName ?? "Operation",
        durationMs: null,
        status: "open",
        startedAt: event.timestamp,
      })
    } else if (event.type === "operation_completed" || event.type === "operation_failed") {
      const existing = byId.get(id)
      if (!existing) {
        continue
      }
      byId.set(id, {
        ...existing,
        durationMs:
          event.durationMs ??
          Date.parse(event.timestamp) - Date.parse(existing.startedAt),
        status: event.type === "operation_failed" ? "failed" : "completed",
      })
    }
  }
  const byName = new Map<string, OpSummary>()
  for (const summary of byId.values()) {
    const prior = byName.get(summary.name)
    if (!prior || (summary.durationMs ?? 0) > (prior.durationMs ?? 0)) {
      byName.set(summary.name, {
        name: summary.name,
        durationMs: summary.durationMs,
        status: summary.status,
      })
    }
  }
  return [...byName.values()]
}

function buildOperationCompare(
  current: ReadonlyArray<OpSummary>,
  peers: ReadonlyArray<ReadonlyArray<OpSummary>>,
): ReadonlyArray<OperationCompareRow> {
  const names = new Set<string>([
    ...current.map((item) => item.name),
    ...peers.flatMap((list) => list.map((item) => item.name)),
  ])
  return [...names]
    .sort((left, right) => left.localeCompare(right))
    .map((name) => {
      const currentOp = current.find((item) => item.name === name)
      const peerDurations = peers.flatMap((list) => {
        const match = list.find((item) => item.name === name)
        return match?.durationMs == null ? [] : [match.durationMs]
      })
      return {
        name,
        currentDurationMs: currentOp?.durationMs ?? null,
        currentStatus: currentOp?.status ?? "absent",
        peerMedianDurationMs: percentile(peerDurations, 0.5),
        peerPresentCount: peers.filter((list) =>
          list.some((item) => item.name === name),
        ).length,
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
) {
  const db = yield* Database
  const [current] = yield* runQuery(DatabaseOperation.ReadRun, () =>
    db.execute<StoredRun>(currentRunSql(projectId, runId)),
  )
  if (!current) {
    return emptyComparison
  }
  const peers = yield* runQuery(DatabaseOperation.ReadPeerRuns, () =>
    db.execute<StoredRun>(peerRunsSql(projectId, runId)),
  )
  const peerList = Array.from(peers)
  const finished = peerList.filter((run) => run.status !== "Running")
  const durations = peerList.flatMap((run) =>
    run.durationMs == null ? [] : [run.durationMs],
  )
  const completed = finished.filter((run) => run.status === "Completed").length
  const currentTimeline = yield* getRunTimeline(projectId, runId)
  const peerTimelines = yield* Effect.forEach(
    peerList.slice(0, 20),
    (peer) => getRunTimeline(projectId, peer.id),
    { concurrency: 4 },
  )
  const operations = buildOperationCompare(
    operationSummaries(currentTimeline),
    peerTimelines.map(operationSummaries),
  )
  return {
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
