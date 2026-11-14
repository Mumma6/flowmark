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
import type { RunComparisonEvidence, StoredRun } from "../types.js"

const emptyEvidence: RunComparisonEvidence = {
  current: null,
  peers: [],
  currentOperations: [],
  peerOperations: [],
}

export const getRunComparisonEvidence = Effect.fn("getRunComparisonEvidence")(
  function* (projectId: string, runId: string, input: PeerSelection = {}) {
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
      return emptyEvidence
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
    const durations = peerList.flatMap((run) =>
      run.durationMs == null ? [] : [run.durationMs],
    )
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
            events: timeline,
          })),
        ),
      { concurrency: 4 },
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
      currentOperations: currentTimeline,
      peerOperations: peerTimelines,
    } satisfies RunComparisonEvidence
  },
)
