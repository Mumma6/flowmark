"use client"

import { useQuery } from "@tanstack/react-query"
import { useMemo } from "react"
import { useTRPC, useTRPCClient } from "../platform/api-trpc"
import { useProject } from "../projects/project-context"

export function useRunExpectations(id: string) {
  const trpc = useTRPC()
  const client = useTRPCClient()
  const { current } = useProject()
  return useQuery({
    queryKey: [
      ...trpc.run.expectations.queryKey({ id }),
      { projectId: current?.id ?? null },
    ],
    queryFn: ({ signal }) => client.run.expectations.query({ id }, { signal }),
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
