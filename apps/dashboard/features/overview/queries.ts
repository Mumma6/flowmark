"use client"

import { useQuery } from "@tanstack/react-query"
import { useMemo } from "react"
import { useTRPC } from "../../lib/api/trpc"
import { defaultIntelligenceQuery } from "../period/period"
import { useProject } from "../projects/project-context"

export function useIntelligence(workflow?: string) {
  const trpc = useTRPC()
  const { current } = useProject()
  const input = useMemo(() => defaultIntelligenceQuery(workflow), [workflow])
  return useQuery({
    ...trpc.project.intelligence.queryOptions(input),
    enabled: Boolean(current),
  })
}
