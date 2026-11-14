"use client"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Effect } from "effect"
import { useState } from "react"
import {
  BrowserEmailChange,
  EmailChangeClientError,
  runBrowserEmailChange,
} from "./browser-runtime"

export function useEmailChange(userId: string, currentSessionId: string) {
  const cache = useQueryClient()
  const key = ["account-email-change", userId, currentSessionId] as const
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const status = useQuery({
    queryKey: key,
    gcTime: 0,
    staleTime: 0,
    retry: false,
    queryFn: ({ signal }) =>
      runBrowserEmailChange(
        Effect.gen(function* () {
          const status = yield* (yield* BrowserEmailChange).status(signal)
          if (
            status.userId !== userId ||
            status.currentSessionId !== currentSessionId
          ) {
            return yield* new EmailChangeClientError({
              message:
                "Your sign-in changed. Refresh your account before reviewing an email change.",
            })
          }
          return status
        }),
      ),
  })
  const refresh = () => cache.invalidateQueries({ queryKey: key })
  const request = useMutation({
    gcTime: 0,
    mutationFn: (input: { newEmail: string; password: string }) =>
      runBrowserEmailChange(
        Effect.flatMap(BrowserEmailChange, (service) =>
          service.request({ ...input, currentSessionId }),
        ),
      ),
    onMutate: () => {
      setError(null)
      setMessage(null)
    },
    onSuccess: () => {
      setMessage(
        "Request recorded. If the address can be used, check your current inbox for approval. Your email has not changed.",
      )
    },
    onError: (error) => setError(error.message),
    onSettled: async () => {
      request.reset()
      await refresh()
    },
  })
  const cancel = useMutation({
    mutationFn: (id: string) =>
      runBrowserEmailChange(
        Effect.flatMap(BrowserEmailChange, (service) =>
          service.cancel({ id, currentSessionId }),
        ),
      ),
    onMutate: () => {
      setError(null)
      setMessage(null)
    },
    onSuccess: () => {
      setMessage(
        "Pending change cancelled. Its links can no longer change your email.",
      )
    },
    onError: (error) => setError(error.message),
    onSettled: refresh,
  })
  const retry = useMutation({
    mutationFn: (id: string) =>
      runBrowserEmailChange(
        Effect.flatMap(BrowserEmailChange, (service) =>
          service.retryNotice({ id, currentSessionId }),
        ),
      ),
    onMutate: () => {
      setError(null)
      setMessage(null)
    },
    onSuccess: () => {
      setMessage(
        "The security notice was submitted again to the fixed previous address.",
      )
    },
    onError: (error) => setError(error.message),
    onSettled: refresh,
  })
  return {
    status,
    clearFeedback: () => {
      setError(null)
      setMessage(null)
    },
    error,
    message,
    pending: request.isPending || cancel.isPending || retry.isPending,
    request: request.mutate,
    cancel: cancel.mutate,
    retry: retry.mutate,
  }
}
