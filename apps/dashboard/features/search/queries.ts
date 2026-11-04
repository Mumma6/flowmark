"use client"

import { useQuery } from "@tanstack/react-query"
import { useTRPC, useTRPCClient } from "../platform/api-trpc"
import { useProject } from "../projects/project-context"

export function useProjectSearch(query: string, enabled: boolean) {
  const trpc = useTRPC()
  const client = useTRPCClient()
  const { current } = useProject()
  return useQuery({
    // The transport uses the selected-project header; do not reuse another
    // project's results for the same text during an in-flight switch.
    queryKey: [
      ...trpc.search.project.queryKey({ query }),
      { projectId: current?.id ?? null },
    ],
    // The custom cache key is not a protocol input. Send only the accepted
    // search contract and cancel the old request when its observer unmounts.
    queryFn: ({ signal }) => client.search.project.query({ query }, { signal }),
    enabled: enabled && Boolean(current),
    refetchInterval: false,
    refetchOnWindowFocus: false,
    retry: false,
  })
}
