"use client"

import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query"
import { useTRPC, useTRPCClient } from "../platform/api-trpc"
import { initialJourneyQuery, type JourneySelection } from "./journey-selection"
import type { ReferenceJourneyQuery } from "@flowmarkdev/core"
import { referenceJourneyQueryOptions } from "./journey-query"

export function useReferenceJourney(selection: JourneySelection) {
  const trpc = useTRPC()
  const client = useTRPCClient()
  const cache = useQueryClient()
  const optionsFor = (query: ReferenceJourneyQuery) =>
    referenceJourneyQueryOptions(
      trpc.workflow.journey.queryKey(query),
      { ...selection, query },
      (input, signal) => client.workflow.journey.query(input, { signal }),
    )
  const result = useInfiniteQuery(optionsFor(selection.query))
  return {
    result,
    restart: () =>
      cache.resetQueries({
        queryKey: optionsFor(initialJourneyQuery(selection.query)).queryKey,
        exact: true,
      }),
  }
}
