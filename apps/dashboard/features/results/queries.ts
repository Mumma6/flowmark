"use client"

import { toast } from "@flowmark/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTRPC } from "../platform/api-trpc"

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

export function useWorkflowMeaning(workflow: string, enabled = true) {
  const trpc = useTRPC()
  return useQuery(
    trpc.workflow.meaning.queryOptions({ workflow, limit: 1 }, { enabled }),
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
        toast.add({ title: "Result declaration saved", type: "success" })
        onSaved()
        void cache.invalidateQueries({
          queryKey: trpc.resultDeclarations.list.queryKey(),
        })
        void cache.invalidateQueries({
          queryKey: trpc.workflow.meaning.queryKey(),
        })
        void cache.invalidateQueries({
          queryKey: trpc.workflow.discover.queryKey(),
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
        toast.add({ title: "Search fields saved", type: "success" })
        onSaved()
        void cache.invalidateQueries({
          queryKey: trpc.resultDeclarations.searchFields.queryKey(),
        })
        void cache.invalidateQueries({ queryKey: trpc.run.list.queryKey() })
        void cache.invalidateQueries({
          queryKey: trpc.workflow.meaning.queryKey(),
        })
        void cache.invalidateQueries({
          queryKey: trpc.workflow.discover.queryKey(),
        })
      },
    }),
  )
}
