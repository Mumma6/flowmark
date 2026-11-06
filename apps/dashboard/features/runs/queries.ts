"use client"

import { useQuery } from "@tanstack/react-query"
import { useTRPC, useTRPCClient } from "../platform/api-trpc"
import { useProject } from "../projects/project-context"
import { peerSelection } from "./peer-selection"

export function useRunDetail(
  id: string,
  params: Pick<URLSearchParams, "get">,
  enabled = true,
) {
  const selection = peerSelection(params)
  const trpc = useTRPC()
  const client = useTRPCClient()
  const { current } = useProject()
  const detail = useQuery({
    queryKey: [
      ...trpc.run.detail.queryKey({ id }),
      { projectId: current?.id ?? null },
    ],
    queryFn: ({ signal }) => client.run.detail.query({ id }, { signal }),
    enabled: enabled && Boolean(current),
  })
  const comparison = useQuery({
    queryKey: [
      ...trpc.run.compare.queryKey({ id, selection }),
      { projectId: current?.id ?? null },
    ],
    queryFn: ({ signal }) =>
      client.run.compare.query({ id, selection }, { signal }),
    enabled: enabled && Boolean(current),
  })
  return { detail, comparison }
}
