"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTRPC } from "../../lib/api/trpc"

export function useResultDeclarations(
  projectId: string,
  workflow: string,
  enabled = true,
) {
  const trpc = useTRPC()
  return useQuery(
    trpc.resultDeclarations.list.queryOptions(
      { projectId, workflow },
      { enabled },
    ),
  )
}
export function useWorkflowSearchFields(
  projectId: string,
  workflow: string,
  enabled = true,
) {
  const trpc = useTRPC()
  return useQuery(
    trpc.resultDeclarations.searchFields.queryOptions(
      { projectId, workflow },
      { enabled },
    ),
  )
}
export function useCreateDeclaration(onSaved: () => void) {
  const trpc = useTRPC()
  const cache = useQueryClient()
  return useMutation(
    trpc.resultDeclarations.create.mutationOptions({
      onSuccess: () => {
        onSaved()
        void cache.invalidateQueries({
          queryKey: trpc.resultDeclarations.list.queryKey(),
        })
      },
    }),
  )
}
export function useSaveSearchFields(onSaved: () => void) {
  const trpc = useTRPC()
  const cache = useQueryClient()
  return useMutation(
    trpc.resultDeclarations.setSearchFields.mutationOptions({
      onSuccess: () => {
        onSaved()
        void cache.invalidateQueries({
          queryKey: trpc.resultDeclarations.searchFields.queryKey(),
        })
        void cache.invalidateQueries({ queryKey: trpc.run.list.queryKey() })
      },
    }),
  )
}
