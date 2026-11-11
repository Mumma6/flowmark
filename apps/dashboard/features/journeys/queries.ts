"use client"

import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query"
import { useTRPC, useTRPCClient } from "../platform/api-trpc"
import type { JourneySelection } from "./journey-selection"
import { referenceJourneyQueryOptions } from "./journey-query"

export function useReferenceJourney(selection: JourneySelection) {
  const trpc = useTRPC()
  const client = useTRPCClient()
  const cache = useQueryClient()
  const options = referenceJourneyQueryOptions(
    trpc.workflow.journey.queryKey(selection.query),
    selection,
    (input, signal) => client.workflow.journey.query(input, { signal }),
  )
  const result = useInfiniteQuery(options)
  return {
    result,
    restart: () =>
      cache.resetQueries({ queryKey: options.queryKey, exact: true }),
  }
}
