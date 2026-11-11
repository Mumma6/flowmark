import { infiniteQueryOptions, type QueryKey } from "@tanstack/react-query"
import type {
  ReferenceJourneyPage,
  ReferenceJourneyQuery,
} from "@flowmarkdev/core"
import {
  journeyPageInput,
  nextJourneyPage,
  type JourneyPageParam,
  type JourneySelection,
} from "./journey-selection"

/** Shared with boundary tests so the actual Studio page/cache policy is exercised. */
export const referenceJourneyQueryOptions = (
  path: QueryKey,
  selection: JourneySelection,
  read: (
    input: ReferenceJourneyQuery,
    signal: AbortSignal,
  ) => Promise<ReferenceJourneyPage>,
) =>
  infiniteQueryOptions({
    queryKey: [
      ...path,
      { projectId: selection.projectId, kind: "journey-pages" },
    ],
    initialPageParam: { kind: "initial" } as JourneyPageParam,
    queryFn: ({ signal, pageParam }) =>
      read(journeyPageInput(selection.query, pageParam), signal),
    getNextPageParam: nextJourneyPage,
    maxPages: 4,
    retry: false,
    refetchOnWindowFocus: false,
    refetchInterval: false,
  })
