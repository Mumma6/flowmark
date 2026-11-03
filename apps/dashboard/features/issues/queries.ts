"use client"

import { useQuery } from "@tanstack/react-query"
import { useTRPC } from "../platform/api-trpc"
import { useProject } from "../projects/project-context"

export function useFailedRuns(
  workflow: string | undefined,
  period: { currentStartedAfter: string; currentStartedBefore: string },
) {
  const trpc = useTRPC()
  const { current } = useProject()
  return useQuery({
    ...trpc.run.list.queryOptions({
      status: "Failed",
      workflow,
      startedAfter: period.currentStartedAfter,
      startedBeforeExclusive: period.currentStartedBefore,
      limit: 8,
    }),
    enabled: Boolean(current),
  })
}
