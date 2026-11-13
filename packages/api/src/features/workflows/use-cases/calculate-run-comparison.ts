import { Array, Effect, Number, Option, Order, pipe } from "effect"
import {
  EvidenceEngine,
  type OperationSummary,
} from "@flowmark/evidence-engine"
import type {
  OperationCompareRow,
  RunComparison,
  RunComparisonEvidence,
} from "../types.js"

/** Reads and authorization remain outside this application calculation. */
export const calculateRunComparison = Effect.fn("calculateRunComparison")(
  function* (evidence: RunComparisonEvidence) {
    if (evidence.current === null) {
      const empty: RunComparison = {
        current: null,
        peers: [],
        peerSuccessRate: null,
        peerMedianDurationMs: null,
        peerP95DurationMs: null,
        operations: [],
      }
      return empty
    }
    const engine = yield* EvidenceEngine
    const current = yield* engine.summarizeOperations(
      evidence.currentOperations,
    )
    const peers = yield* Effect.forEach(
      evidence.peerOperations,
      ({ runId, events }) =>
        engine
          .summarizeOperations(events)
          .pipe(Effect.map((operations) => ({ runId, operations }))),
    )
    const names = pipe(
      [
        ...Array.map(current, (item) => item.name),
        ...Array.flatMap(peers, ({ operations }) =>
          Array.map(operations, (item) => item.name),
        ),
      ],
      Array.dedupe,
      Array.sort(
        Order.make((left: string, right: string) =>
          Number.Order(left.localeCompare(right), 0),
        ),
      ),
      Array.take(100),
    )
    const find = (operations: readonly OperationSummary[], name: string) =>
      Option.getOrUndefined(
        Array.findFirst(operations, (item) => item.name === name),
      )
    const operations = yield* Effect.forEach(names, (name) =>
      Effect.gen(function* () {
        const currentOp = find(current, name)
        const matches = Array.map(peers, (peer) => ({
          runId: peer.runId,
          operation: find(peer.operations, name),
        }))
        const peerValues = (
          value: (operation: OperationSummary) => number | null,
        ) =>
          Array.flatMap(matches, ({ operation }) => {
            const n = operation ? value(operation) : null
            return n === null ? [] : [n]
          })
        return {
          name,
          currentDurationMs: currentOp?.durationMs ?? null,
          currentOccurrenceCount: currentOp?.occurrenceCount ?? 0,
          currentOpenCount: currentOp?.openCount ?? 0,
          currentFailedCount: currentOp?.failedCount ?? 0,
          currentMedianOccurrenceDurationMs:
            currentOp?.medianDurationMs ?? null,
          currentTotalRecordedDurationMs:
            currentOp?.totalRecordedDurationMs ?? null,
          currentStatus: currentOp?.status ?? "absent",
          peerMedianDurationMs: yield* engine.percentile(
            peerValues((item) => item.durationMs),
            0.5,
          ),
          peerMedianOccurrenceDurationMs: yield* engine.percentile(
            peerValues((item) => item.medianDurationMs),
            0.5,
          ),
          peerMedianTotalRecordedDurationMs: yield* engine.percentile(
            peerValues((item) => item.totalRecordedDurationMs),
            0.5,
          ),
          peerOpenRunCount: Array.filter(
            matches,
            ({ operation }) => (operation?.openCount ?? 0) > 0,
          ).length,
          peerFailedRunCount: Array.filter(
            matches,
            ({ operation }) => (operation?.failedCount ?? 0) > 0,
          ).length,
          peerPresentCount: Array.filter(
            matches,
            ({ operation }) => operation !== undefined,
          ).length,
          peerRunIds: Array.flatMap(matches, ({ runId, operation }) =>
            operation ? [runId] : [],
          ),
        } satisfies OperationCompareRow
      }),
    )
    const finished = Array.filter(
      evidence.peers,
      (run) => run.status !== "Running",
    )
    const completed = Array.filter(
      finished,
      (run) => run.status === "Completed",
    ).length
    const durations = Array.flatMap(evidence.peers, (run) =>
      run.durationMs === null ? [] : [run.durationMs],
    )
    return {
      ...(evidence.population ? { population: evidence.population } : {}),
      current: evidence.current,
      peers: evidence.peers,
      peerSuccessRate:
        finished.length === 0
          ? null
          : Math.round((1000 * completed) / finished.length) / 10,
      peerMedianDurationMs: yield* engine.percentile(durations, 0.5),
      peerP95DurationMs: yield* engine.percentile(durations, 0.95),
      operations,
    } satisfies RunComparison
  },
)
