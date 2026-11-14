"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Array, Data, Option } from "effect"
import { useState } from "react"
import { useTRPC, useTRPCClient } from "../../platform/api-trpc"

class SessionIdentityChanged extends Data.TaggedError(
  "SessionIdentityChanged",
)<{ readonly message: string }> {}

type Target =
  | { readonly kind: "single"; readonly sessionId: string }
  | { readonly kind: "others" }
export function useAccountSessions(ownerId: string) {
  const trpc = useTRPC()
  const cache = useQueryClient()
  const rpc = useTRPCClient()
  const [target, setTarget] = useState<Target | null>(null)
  const [confirmationSessionId, setConfirmationSessionId] = useState<
    string | null
  >(null)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const queryKey = ["account-sessions", ownerId] as const
  const sessions = useQuery({
    queryKey,
    queryFn: async ({ signal }) => {
      const view = await rpc.accountSessions.list.query(undefined, { signal })
      if (view.userId !== ownerId) {
        throw new SessionIdentityChanged({
          message:
            "Your account changed. Sign in again before managing sessions.",
        })
      }
      return view.sessions
    },
    gcTime: 0,
    staleTime: 0,
    retry: false,
  })
  const revoke = useMutation(
    trpc.accountSessions.revoke.mutationOptions({
      gcTime: 0,
      onSuccess: async () => {
        setConfirmationSessionId(null)
        setTarget(null)
        setSaved(
          "The selected sessions have been signed out. Previously granted agent connections and project keys are managed separately.",
        )
        await cache.invalidateQueries({ queryKey })
      },
      onError: (failure) => {
        if (failure.data?.code === "CONFLICT") {
          setTarget(null)
          setConfirmationSessionId(null)
        }
        setError(failure.message)
        // Refresh even on failure: the provider may have completed part of a bulk operation.
        void cache.invalidateQueries({ queryKey })
      },
      onSettled: () => {
        revoke.reset()
      },
    }),
  )
  return {
    sessions,
    target,
    error,
    saved,
    pending: revoke.isPending,
    select: (target: Target | null) => {
      setError(null)
      setSaved(null)
      if (target === null) {
        setTarget(null)
        setConfirmationSessionId(null)
        return
      }
      const current = Array.findFirst(
        sessions.data ?? [],
        (session) => session.current,
      ).pipe(Option.getOrNull)
      if (!current) {
        setError("Refresh your sessions before reviewing sign-out.")
        return
      }
      setConfirmationSessionId(current.id)
      setTarget(target)
    },
    confirm: (password: string) => {
      if (target && confirmationSessionId && !revoke.isPending) {
        setError(null)
        setSaved(null)
        revoke.mutate({
          currentSessionId: confirmationSessionId,
          target,
          password,
        })
      }
    },
  }
}
