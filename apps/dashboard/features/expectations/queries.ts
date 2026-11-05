"use client"

import { useInfiniteQuery, useQuery } from "@tanstack/react-query"
import { useMemo } from "react"
import { useTRPC, useTRPCClient } from "../platform/api-trpc"
import { useProject } from "../projects/project-context"

export function useRunExpectations(id: string) {
  const trpc = useTRPC()
  const client = useTRPCClient()
  const { current } = useProject()
  return useInfiniteQuery({
    queryKey: [
      ...trpc.run.expectationsPage.queryKey({ runId: id }),
      { projectId: current?.id ?? null },
    ],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) =>
      client.run.expectationsPage.query(
        { runId: id, cursor: pageParam },
        { signal },
      ),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    enabled: Boolean(current),
    refetchInterval: 10000,
  })
}
export function useExpectationAttention(
  workflow?: string,
  startedAfter?: string,
  startedBeforeExclusive?: string,
) {
  const trpc = useTRPC()
  const { current } = useProject()
  const fallback = useMemo(() => {
    const end = new Date()
    return {
      startedAfter: new Date(end.getTime() - 30 * 86400000).toISOString(),
      startedBefore: end.toISOString(),
    }
  }, [])
  const bounded = Boolean(startedAfter && startedBeforeExclusive)
  const window = bounded
    ? {
        startedAfter: startedAfter ?? fallback.startedAfter,
        startedBeforeExclusive,
      }
    : fallback
  const query = useQuery({
    ...trpc.run.list.queryOptions({ ...window, workflow, limit: 1 }),
    enabled: Boolean(current),
    refetchInterval: 10000,
  })
  return { query, window, bounded }
}
