"use client"

import { useQuery } from "@tanstack/react-query"
import { useTRPC } from "../../lib/api/trpc"
import { useProject } from "./project-context"

export function useProjectKeys() {
  const trpc = useTRPC()
  const { current } = useProject()
  return useQuery({
    ...trpc.project.keys.queryOptions(current?.id ?? ""),
    enabled: Boolean(current),
  })
}
