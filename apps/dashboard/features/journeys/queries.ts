"use client"

import { useInfiniteQuery } from "@tanstack/react-query"
import { useTRPC, useTRPCClient } from "../platform/api-trpc"
import {
  journeyPageInput,
  nextJourneyPage,
  type JourneyPageParam,
  type JourneySelection,
} from "./journey-selection"

export function useReferenceJourney(selection: JourneySelection) {
  const trpc = useTRPC()
  const client = useTRPCClient()
  return useInfiniteQuery({
    queryKey: [
      ...trpc.workflow.journey.queryKey(selection.query),
      { projectId: selection.projectId, kind: "journey-pages" },
    ],
    initialPageParam: { kind: "initial" } as JourneyPageParam,
    queryFn: ({ signal, pageParam }) =>
      client.workflow.journey.query(
        journeyPageInput(selection.query, pageParam),
        { signal },
      ),
    getNextPageParam: nextJourneyPage,
    // At most 100 visible records, including an ambiguous anchor chooser.
    maxPages: 4,
    retry: false,
    refetchOnWindowFocus: false,
    refetchInterval: false,
  })
}
