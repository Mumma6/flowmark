"use client"

import { useQuery } from "@tanstack/react-query"
import { useTRPC } from "../../lib/api/trpc"
import { useProject } from "../projects/project-context"

export function useProjectSearch(query: string, enabled: boolean) {
  const trpc = useTRPC()
  const { current } = useProject()
  return useQuery({
    ...trpc.search.project.queryOptions({
      query,
    }),
    enabled: enabled && Boolean(current),
    refetchInterval: false,
    refetchOnWindowFocus: false,
    retry: false,
  })
}
