import { expect, it } from "vitest"
import { InfiniteQueryObserver, QueryClient } from "@tanstack/react-query"
import type {
  ReferenceJourneyPage,
  ReferenceJourneyQuery,
} from "@flowmarkdev/core"
import { Array, Effect, Option } from "effect"
import { referenceJourneyQueryOptions } from "../features/journeys/journey-query"
import type { JourneySelection } from "../features/journeys/journey-selection"

it("retains a bounded candidate window, restarts from the true first page, and leaves another project's cache alone", async () => {
  const selection: JourneySelection = {
    projectId: "11111111-1111-4111-8111-111111111111",
    stage: "evidence",
    query: {
      workflow: "patient.match",
      key: "referralRef",
      value: "SYN-REUSED",
      namespaces: [{ workflow: "patient.match", key: "referralRef" }],
    },
  }
  const choices = Array.map(Array.range(0, 131), (index) => ({
    id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    externalId: `choice-${index}`,
    workflow: "patient.match",
    startedAt: "2026-10-01T10:00:00Z",
  }))
  const read = (
    query: ReferenceJourneyQuery,
    signal: AbortSignal,
  ): Promise<ReferenceJourneyPage> => {
    expect(signal).toBeInstanceOf(AbortSignal)
    expect(query.limit).toBe(25)
    expect(query.anchorRunId).toBeUndefined()
    expect(query.cursor).toBeUndefined()
    const offset = Number(query.candidateCursor ?? 0)
    return Promise.resolve({
      projectId: selection.projectId,
      namespace: { workflow: query.workflow, key: query.key },
      value: query.value,
      namespaces: query.namespaces,
      state: "Ambiguous",
      anchorRunId: null,
      candidates: Array.take(Array.drop(choices, offset), 25),
      nodes: [],
      edges: [],
      nextCursor: null,
      nextCandidateCursor:
        offset + 25 < choices.length ? String(offset + 25) : null,
      bounds: {
        maxDepth: 4,
        maxNodes: 100,
        pageLimit: 25,
        traversalTruncated: false,
        cycleDetected: false,
      },
      coverage:
        "Recorded linked evidence only; downstream sampling is not a complete funnel.",
    })
  }
  const options = referenceJourneyQueryOptions(
    ["workflow", "journey", selection.query],
    selection,
    read,
  )
  const foreignOptions = referenceJourneyQueryOptions(
    ["workflow", "journey", selection.query],
    { ...selection, projectId: "22222222-2222-4222-8222-222222222222" },
    read,
  )
  const cache = new QueryClient()
  const observer = new InfiniteQueryObserver(cache, options)
  try {
    const initial = await observer.refetch()
    const first = Option.getOrThrow(Option.fromNullishOr(initial.data))
    cache.setQueryData(foreignOptions.queryKey, first)
    const seen = await Effect.runPromise(
      Effect.reduce(
        Array.range(1, 5),
        () => Array.map(first.pages[0]!.candidates, (row) => row.id),
        (ids) =>
          Effect.promise(() => observer.fetchNextPage()).pipe(
            Effect.map((next) => [
              ...ids,
              ...Array.map(
                Option.getOrThrow(Array.last(next.data!.pages)).candidates,
                (row) => row.id,
              ),
            ]),
          ),
      ),
    )
    expect(seen).toEqual(Array.map(choices, (row) => row.id))
    expect(observer.getCurrentResult().data?.pages).toHaveLength(4)
    expect(observer.getCurrentResult().data?.pageParams[0]).toEqual({
      kind: "candidates",
      cursor: "50",
    })
    const refreshed = await observer.refetch()
    expect(refreshed.data?.pages[0]?.candidates[0]?.id).toBe(choices[50]!.id)
    // Refetch preserves the evicted window; only an exact reset actually restarts.
    await cache.resetQueries({ queryKey: options.queryKey, exact: true })
    const restarted = await observer.refetch()
    expect(restarted.data?.pageParams).toEqual([{ kind: "initial" }])
    expect(restarted.data?.pages[0]?.candidates).toEqual(
      Array.take(choices, 25),
    )
    expect(cache.getQueryData(foreignOptions.queryKey)).toEqual(first)
  } finally {
    observer.destroy()
    cache.clear()
  }
})
