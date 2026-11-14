import { Array, Effect } from "effect"
import { Engine } from "@flowmark/engine"
import type { ReferenceJourneyEvidence } from "../types.js"

/** The complete bounded graph, rather than the visible page, determines cycles. */
export const calculateReferenceJourney = Effect.fn("calculateReferenceJourney")(
  function* ({ page, graph }: ReferenceJourneyEvidence) {
    if (page.state !== "Selected") {
      return page
    }
    const engine = yield* Engine
    const cycleDetected = yield* engine.hasCycle({
      nodes: graph.nodes,
      edges: Array.map(
        Array.filter(graph.edges, (edge) => edge.scope === "journey"),
        (edge) => ({ from: edge.fromRunId, to: edge.toRunId }),
      ),
    })
    return { ...page, bounds: { ...page.bounds, cycleDetected } }
  },
)
