"use client"

import { useQuery } from "@tanstack/react-query"
import { useTRPC } from "../../lib/api/trpc"
import { useProject } from "../projects/project-context"
import { peerSelection } from "./peer-selection"

export function useRunDetail(id: string, params: Pick<URLSearchParams, "get">) {
  const selection = peerSelection(params)
  const trpc = useTRPC()
  const { current } = useProject()
  const detail = useQuery({
    ...trpc.run.detail.queryOptions({ id }),
    enabled: Boolean(current),
  })
  const relationships = useQuery({
    ...trpc.run.related.queryOptions({ id }),
    enabled: Boolean(current),
  })
  const comparison = useQuery({
    ...trpc.run.compare.queryOptions({ id, selection }),
    enabled: Boolean(current),
  })
  return { detail, relationships, comparison }
}
