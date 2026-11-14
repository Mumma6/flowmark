"use client"

import type { inferRouterOutputs } from "@trpc/server"
import type { AppRouter } from "@flowmark/server/trpc"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Result } from "effect"
import { useEffect, useState } from "react"
import { useTRPC } from "../../platform/api-trpc"
import {
  readCleanupRecovery,
  saveCleanupRecovery,
  removeCleanupRecovery,
  cleanupAccessInput,
  type CleanupRecovery,
} from "./cleanup-recovery"

type Operation = inferRouterOutputs<AppRouter>["accountLifecycle"]["status"]
export function useAccountErasure() {
  const trpc = useTRPC()
  const cache = useQueryClient()
  const [ready, setReady] = useState(false)
  const [recovery, setRecovery] = useState<CleanupRecovery | null>(null)
  const [operation, setOperation] = useState<Operation | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  useEffect(() => {
    Result.match(readCleanupRecovery(), {
      onSuccess: (value) => setRecovery(value?.confirmed ? value : null),
      onFailure: () =>
        setError(
          "Saved cleanup access could not be read. Paste your recovery code below.",
        ),
    })
    setReady(true)
  }, [])
  const remember = (value: CleanupRecovery) =>
    Result.match(saveCleanupRecovery(value), {
      onSuccess: () => {
        setRecovery(value)
        return true
      },
      onFailure: () => {
        setError(
          "This browser could not save cleanup access. Enable session storage before confirming deletion.",
        )
        return false
      },
    })
  const changed = (value: Operation) => {
    setOperation(value)
    if (value.state === "live_data_deleted") {
      setRunning(false)
      Result.match(removeCleanupRecovery(), {
        onSuccess: () => undefined,
        onFailure: () =>
          setError(
            "Live data was deleted. Clear this tab’s saved cleanup code manually.",
          ),
      })
      setRecovery(null)
      cache.clear()
    }
  }
  const failed = (error: { readonly message: string }) => {
    setRunning(false)
    setError(error.message)
  }
  const preview = useMutation(
    trpc.accountLifecycle.preview.mutationOptions({
      gcTime: 0,
      onSuccess: ({ operation, capability }) => {
        setOperation(operation)
        setError(null)
        remember({ operationId: operation.id, capability, confirmed: false })
      },
      onError: failed,
      onSettled: (): void => {
        preview.reset()
      },
    }),
  )
  const cancel = useMutation(
    trpc.accountLifecycle.cancel.mutationOptions({
      onSuccess: () => {
        Result.match(removeCleanupRecovery(), {
          onSuccess: () => {
            setOperation(null)
            setRecovery(null)
          },
          onFailure: () =>
            setError(
              "Preview cancelled. Clear this tab’s saved code manually.",
            ),
        })
      },
      onError: failed,
    }),
  )
  const confirm = useMutation(
    trpc.accountLifecycle.confirm.mutationOptions({
      gcTime: 0,
      onSuccess: (value) => {
        changed(value)
        cache.clear()
        setRunning(true)
      },
      onError: failed,
      onSettled: (): void => {
        confirm.reset()
      },
    }),
  )
  const status = useMutation(
    trpc.accountLifecycle.status.mutationOptions({
      gcTime: 0,
      onSuccess: changed,
      onError: failed,
      onSettled: (): void => {
        status.reset()
      },
    }),
  )
  const resume = useMutation(
    trpc.accountLifecycle.resume.mutationOptions({
      gcTime: 0,
      onSuccess: changed,
      onError: failed,
      onSettled: (): void => {
        resume.reset()
      },
    }),
  )
  const statusMutate = status.mutate
  useEffect(() => {
    if (ready && recovery?.confirmed && !operation) {
      statusMutate(cleanupAccessInput(recovery))
    }
  }, [ready, recovery, operation, statusMutate])
  const resumeMutate = resume.mutate
  const resumePending = resume.isPending
  useEffect(() => {
    if (
      running &&
      recovery &&
      operation?.state === "purging" &&
      !resumePending &&
      !error
    ) {
      resumeMutate(cleanupAccessInput(recovery))
    }
  }, [running, recovery, operation, resumePending, resumeMutate, error])
  return {
    ready,
    recovery,
    operation,
    error,
    running,
    busy:
      preview.isPending ||
      confirm.isPending ||
      cancel.isPending ||
      status.isPending ||
      resume.isPending,
    preview: () => {
      setError(null)
      preview.mutate()
    },
    confirm: (confirmation: string, password: string) => {
      if (recovery && remember({ ...recovery, confirmed: true })) {
        setError(null)
        confirm.mutate({
          operationId: recovery.operationId,
          confirmation,
          password,
        })
      }
    },
    checkStatus: () => {
      if (recovery) {
        setError(null)
        status.mutate(cleanupAccessInput(recovery))
      }
    },
    resume: () => {
      setError(null)
      setRunning(true)
    },
    pause: () => setRunning(false),
    recover: (value: CleanupRecovery) => {
      if (remember(value)) {
        setOperation(null)
        setError(null)
      }
    },
    cancelPreview: () => {
      if (recovery) {
        cancel.mutate({ operationId: recovery.operationId })
      }
    },
  }
}
