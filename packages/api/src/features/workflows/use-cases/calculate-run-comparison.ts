import { Array, Effect, Number, Option, Order, pipe } from "effect"
import { Engine } from "@flowmark/engine"
import type { RunComparison, RunComparisonEvidence } from "../types.js"

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
    const engine = yield* Engine
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
    // Keep the existing host-locale display order and 100-row presentation limit.
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
    const samples = Array.map(evidence.peers, (peer) => ({
      runId: peer.id,
      status: peer.status,
      durationMs: peer.durationMs,
      operations: Option.getOrThrow(
        Array.findFirst(peers, (sample) => sample.runId === peer.id),
      ).operations,
    }))
    const comparison = yield* engine.compareSummaries({
      current,
      peers: samples,
      names,
    })
    return {
      ...(evidence.population ? { population: evidence.population } : {}),
      current: evidence.current,
      peers: evidence.peers,
      ...comparison,
    } satisfies RunComparison
  },
)
