import { expect, it } from "vitest"
import { Effect } from "effect"
import { Engine, EngineError } from "@flowmark/engine"
import { calculateReferenceJourney } from "../../src/features/workflows/use-cases/calculate-reference-journey.js"
import type { ReferenceJourneyEvidence } from "../../src/features/workflows/types.js"

const evidence: ReferenceJourneyEvidence = {
  page: {
    projectId: "project",
    namespace: { workflow: "work", key: "ref" },
    value: "x",
    namespaces: [{ workflow: "work", key: "ref" }],
    state: "Selected",
    anchorRunId: "a",
    candidates: [],
    nextCandidateCursor: null,
    nodes: [
      {
        id: "a",
        externalId: "external",
        workflow: "work",
        startedAt: "2026-01-01T00:00:00Z",
        depth: 0,
        status: "Running",
        outcome: null,
        parent: { state: "absent", matches: [] },
        retry: { state: "absent", matches: [] },
      },
    ],
    edges: [],
    nextCursor: "next",
    bounds: {
      maxDepth: 4,
      maxNodes: 100,
      pageLimit: 1,
      traversalTruncated: false,
      cycleDetected: false,
    },
    coverage:
      "Recorded linked evidence only; downstream sampling is not a complete funnel.",
  },
  graph: {
    nodes: ["a", "b"],
    edges: [
      { fromRunId: "a", toRunId: "b", kind: "parent", scope: "journey" },
      { fromRunId: "b", toRunId: "a", kind: "retry", scope: "journey" },
    ],
  },
}

it("detects cycles across the complete bounded graph even when the page hides one endpoint", async () => {
  const result = await Effect.runPromise(
    calculateReferenceJourney(evidence).pipe(Effect.provide(Engine.layer)),
  )
  expect(result.bounds.cycleDetected).toBe(true)
  expect(result.nodes).toEqual(evidence.page.nodes)
  expect(result.nextCursor).toBe("next")
  expect(result).not.toHaveProperty("graph")
  expect(evidence.page.bounds.cycleDetected).toBe(false)
})
it("does not turn context edges into journey membership", async () => {
  const graph = {
    ...evidence.graph,
    edges: evidence.graph.edges.map((edge) => ({
      ...edge,
      scope: "context" as const,
    })),
  }
  const result = await Effect.runPromise(
    calculateReferenceJourney({ ...evidence, graph }).pipe(
      Effect.provide(Engine.layer),
    ),
  )
  expect(result.bounds.cycleDetected).toBe(false)
})

it("keeps graph initialization failures explicit", async () => {
  const failure = new EngineError({
    operation: "hasCycle",
    stage: "initialization",
    cause: "missing asset",
  })
  const result = await Effect.runPromise(
    Effect.gen(function* () {
      const engine = yield* Engine
      return yield* Effect.result(
        calculateReferenceJourney(evidence).pipe(
          Effect.provideService(Engine, {
            ...engine,
            hasCycle: () => Effect.fail(failure),
          }),
        ),
      )
    }).pipe(Effect.provide(Engine.layer)),
  )
  expect(result).toMatchObject({ _tag: "Failure", failure })
})

it("keeps an unselected journey unchanged without invoking graph analysis", async () => {
  const page = {
    ...evidence.page,
    state: "NotFound" as const,
    anchorRunId: null,
    nodes: [],
  }
  const result = await Effect.runPromise(
    Effect.gen(function* () {
      const engine = yield* Engine
      return yield* calculateReferenceJourney({
        page,
        graph: evidence.graph,
      }).pipe(
        Effect.provideService(Engine, {
          ...engine,
          hasCycle: () => Effect.die("must not load"),
        }),
      )
    }).pipe(Effect.provide(Engine.layer)),
  )
  expect(result).toEqual(page)
})
