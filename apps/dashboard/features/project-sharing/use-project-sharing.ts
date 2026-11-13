"use client"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { useTRPC, useTRPCClient } from "../platform/api-trpc"

export function useProjectSharing(
  projectId: string,
  userId: string,
  sessionId: string,
) {
  const trpc = useTRPC()
  const client = useTRPCClient()
  const cache = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const key = ["project-sharing", userId, sessionId, projectId] as const
  const list = useQuery({
    queryFn: ({ signal }) =>
      client.projectSharing.list.query({ projectId }, { signal }),
    queryKey: key,
    gcTime: 0,
    retry: false,
  })
  const clear = () => {
    setError(null)
    setMessage(null)
  }
  const refresh = () => cache.invalidateQueries({ queryKey: key })
  const invite = useMutation(
    trpc.projectSharing.invite.mutationOptions({
      gcTime: 0,
      onMutate: clear,
      onSuccess: () =>
        setMessage(
          "Invitation recorded. If the address can join, check its inbox. Mail submission does not prove delivery.",
        ),
      onError: (failure) => setError(failure.message),
      onSettled: async () => {
        invite.reset()
        await refresh()
      },
    }),
  )
  const revoke = useMutation(
    trpc.projectSharing.revoke.mutationOptions({
      onMutate: clear,
      onSuccess: () =>
        setMessage("Invitation revoked. Its link no longer grants access."),
      onError: (failure) => setError(failure.message),
      onSettled: refresh,
    }),
  )
  const remove = useMutation(
    trpc.projectSharing.remove.mutationOptions({
      onMutate: clear,
      onSuccess: async () => {
        setMessage(
          "Membership removed. Existing project reads and delegated access no longer authorize this member.",
        )
        // Private project details cannot survive a membership change in this browser.
        cache.removeQueries({
          predicate: (query) => {
            const path = query.queryKey[0]
            return (
              path !== "project-sharing" &&
              !(Array.isArray(path) && path.join(".") === "project.list")
            )
          },
        })
        await cache.invalidateQueries()
      },
      onError: (failure) => setError(failure.message),
      onSettled: refresh,
    }),
  )
  return {
    list,
    error,
    message,
    clear,
    refresh,
    invite,
    revoke,
    remove,
    busy:
      invite.isPending ||
      revoke.isPending ||
      remove.isPending ||
      list.isFetching,
  }
}
