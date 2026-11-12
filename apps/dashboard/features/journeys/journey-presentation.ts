import type { JourneyEdge, JourneyNode } from "@flowmarkdev/core"
import { Array, Match } from "effect"

/** A resolved identity alone does not establish membership in this reference. */
export const journeyParentDescription = (
  node: JourneyNode,
  edges: readonly JourneyEdge[],
) =>
  Match.value(node.parent.state).pipe(
    Match.when("absent", () => "No parent link reported."),
    Match.when(
      "missing",
      () =>
        "Parent link reported; supporting run is missing from recorded evidence.",
    ),
    Match.when(
      "ambiguous",
      () =>
        "Ambiguous parent: these candidates share the reported ID. No parent was chosen.",
    ),
    Match.when("resolved", () =>
      Array.some(
        edges,
        (edge) =>
          edge.kind === "parent" &&
          edge.toRunId === node.id &&
          edge.scope === "journey",
      )
        ? "Reported parent · linked journey execution"
        : "Reported parent · supporting context only",
    ),
    Match.exhaustive,
  )
