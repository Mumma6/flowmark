"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { useTRPC } from "../../lib/api/trpc"
import { useProject } from "../projects/project-context"

export function useProjectSettings() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const { current, projects, select } = useProject()
  const [name, setName] = useState(current?.name ?? "")
  useEffect(() => {
    setName(current?.name ?? "")
  }, [current?.id, current?.name])
  const rename = useMutation(
    trpc.project.rename.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries()
      },
    }),
  )
  return { current, projects, select, name, setName, rename }
}
