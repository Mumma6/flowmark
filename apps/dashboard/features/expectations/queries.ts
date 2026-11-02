"use client"

import { useQuery } from "@tanstack/react-query"
import { useMemo } from "react"
import { useTRPC } from "../../lib/api/trpc"
import { useProject } from "../projects/project-context"

export function useRunExpectations(id: string) {
  const trpc = useTRPC()
  const { current } = useProject()
  return useQuery({
    ...trpc.run.expectations.queryOptions({ id }),
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
