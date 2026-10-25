import { Effect } from "effect"
import { Database } from "../../database.js"
import { DatabaseOperation } from "../../database-operation.js"
import { runQuery } from "../../run-query.js"
import { currentRunSql, peerRunsSql } from "../sql/run-summaries.js"
import type { RunComparison, StoredRun } from "../types.js"

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

const emptyComparison: RunComparison = {
  current: null,
  peers: [],
  peerSuccessRate: null,
  peerMedianDurationMs: null,
  peerP95DurationMs: null,
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
  return {
    current,
    peers: peerList,
    peerSuccessRate:
      finished.length === 0
        ? null
        : Math.round((1000 * completed) / finished.length) / 10,
    peerMedianDurationMs: percentile(durations, 0.5),
    peerP95DurationMs: percentile(durations, 0.95),
  } satisfies RunComparison
})
