"use client"
import { toast } from "@flowmark/ui"

import type { inferRouterOutputs } from "@trpc/server"
import type { AppRouter } from "@flowmark/server/trpc"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { useTRPC, useTRPCClient } from "../../platform/api-trpc"
import { useInvestigationOwner } from "../../investigations/investigation-owner"

export type ErasureOperation =
  inferRouterOutputs<AppRouter>["dataLifecycle"]["preview"]

export function useDataErasure(projectId: string) {
  const trpc = useTRPC()
  const rpc = useTRPCClient()
  const [confirmationError, setConfirmationError] = useState<{
    readonly message: string
  } | null>(null)
  const userId = useInvestigationOwner()
  const client = useQueryClient()
  const [running, setRunning] = useState(false)
  const statusKey = ["data-lifecycle", userId, projectId] as const
  const status = useQuery({
    queryKey: statusKey,
    queryFn: () => rpc.dataLifecycle.status.query({ projectId }),
    refetchOnWindowFocus: true,
  })
  const [operation, setOperation] = useState<ErasureOperation | null>(null)
  const current = operation ?? status.data ?? null
  const changed = (next: ErasureOperation) => {
    setOperation(next)
    client.setQueryData(statusKey, next)
  }
  const preview = useMutation(
    trpc.dataLifecycle.preview.mutationOptions({ onSuccess: changed }),
  )
  const confirm = useMutation(
    trpc.dataLifecycle.confirm.mutationOptions({
      onMutate: () => setConfirmationError(null),
      onError: (error) => setConfirmationError({ message: error.message }),
      onSettled: (): void => {
        confirm.reset()
      },
      gcTime: 0,
      onSuccess: (next) => {
        changed(next)
        // Remove previously visible evidence immediately; retain project selection
        // so this operation remains reachable while ordinary reads are fenced.
        client.removeQueries({
          predicate: (query) => {
            const path = query.queryKey[0]
            return (
              path !== "data-lifecycle" &&
              !(
                Array.isArray(path) &&
                ["project.list", "dataLifecycle.status"].includes(
                  path.join("."),
                )
              )
            )
          },
        })
        setRunning(true)
      },
    }),
  )
  const cancel = useMutation(
    trpc.dataLifecycle.cancel.mutationOptions({ onSuccess: changed }),
  )
  const resume = useMutation(
    trpc.dataLifecycle.resume.mutationOptions({
      onSuccess: (next) => {
        changed(next)
        if (next.state === "live_data_deleted") {
          setRunning(false)
          toast.add({
            title:
              next.scope.kind === "project"
                ? "Project deleted"
                : "Telemetry erased",
            type: "success",
          })
          void client.invalidateQueries()
        }
      },
      onError: () => setRunning(false),
    }),
  )
  const { mutate, isPending, isError } = resume
  // This component owns continuation. Unmounting or pausing launches no further
  // batches; a committed batch is recovered by the status query on reopen.
  useEffect(() => {
    if (running && current?.state === "purging" && !isPending && !isError) {
      mutate({ projectId, operationId: current.id })
    }
  }, [
    running,
    current?.state,
    current?.id,
    current?.phase,
    current?.deletedEvents,
    current?.deletedRuns,
    projectId,
    isPending,
    isError,
    mutate,
  ])
  return {
    current,
    preview,
    confirm,
    cancel,
    confirmationError,
    resume,
    status,
    running,
    pause: () => setRunning(false),
    continue: () => {
      resume.reset()
      setRunning(true)
    },
  }
}
