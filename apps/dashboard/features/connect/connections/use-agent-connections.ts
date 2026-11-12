"use client"

import { feedbackCopy, type ListedConnection } from "./connection-model"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Array as EffectArray, Effect } from "effect"
import { useCallback, useRef, useState } from "react"
import { useTRPC } from "../../platform/api-trpc"
import { useProject } from "../../projects/project-context"
import {
  confirmConnectionRevocation,
  connectionListRecovery,
  interpretOwnedConnection,
  revokeAndConfirmConnection,
  type RevokeFeedback,
} from "./connection-revocation"

export function useAgentConnections() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const { projects } = useProject()
  const list = useQuery(trpc.agentAccess.list.queryOptions())
  const [selected, setSelected] = useState<ListedConnection | null>(null)
  const [feedback, setFeedback] = useState<RevokeFeedback>({ _tag: "Idle" })
  const [feedbackTarget, setFeedbackTarget] = useState<ListedConnection | null>(
    null,
  )
  const [confirming, setConfirming] = useState<ListedConnection | null>(null)
  const listRegion = useRef<HTMLDivElement>(null)
  const focusDetail = useCallback((node: HTMLDivElement | null) => {
    node?.focus()
  }, [])
  const returnFocus = useRef<HTMLButtonElement | null>(null)
  const detail = useQuery({
    ...trpc.agentAccess.connection.queryOptions({
      authorizationCodeId: selected?.authorizationCodeId ?? "",
      clientId: selected?.clientId ?? "",
    }),
    enabled: selected !== null,
  })
  const revoke = useMutation(
    trpc.agentAccess.revokeConnection.mutationOptions(),
  )
  const names = Object.fromEntries(
    EffectArray.map(projects, (project) => [
      project.id.toLowerCase(),
      project.name,
    ]),
  )
  const connections = list.isError ? [] : (list.data ?? [])
  const listRecovery = list.isError ? connectionListRecovery(list.error) : null
  const owned = selected
    ? interpretOwnedConnection({
        listed: EffectArray.some(
          connections,
          (item) =>
            item.authorizationCodeId === selected.authorizationCodeId &&
            item.clientId === selected.clientId,
        ),
        detail: detail.isError
          ? "unavailable"
          : detail.isPending
            ? "pending"
            : detail.data
              ? "present"
              : "absent",
      })
    : { _tag: "Hidden" as const }
  const message = feedbackCopy(feedback)
  const busy = feedback._tag === "Pending"
  const observation = (target: ListedConnection) => ({
    target,
    cancelRead: () =>
      queryClient.cancelQueries({
        queryKey: trpc.agentAccess.list.queryKey(),
        exact: true,
      }),
    read: () =>
      queryClient.fetchQuery({
        ...trpc.agentAccess.list.queryOptions(),
        staleTime: 0,
        retry: false,
      }),
  })
  const refreshFeedback = async () => {
    if (!feedbackTarget || busy) {
      return
    }
    setFeedback({ _tag: "Pending" })
    const result = await Effect.runPromise(
      confirmConnectionRevocation(observation(feedbackTarget)),
    )
    setFeedback(result)
    if (result._tag === "Revoked") {
      setSelected(null)
    }
  }
  const confirmRevoke = async () => {
    if (!confirming || busy) {
      return
    }
    const target = confirming
    setFeedbackTarget(target)
    setFeedback({ _tag: "Pending" })
    const result = await Effect.runPromise(
      revokeAndConfirmConnection({
        ...observation(target),
        revoke: () =>
          revoke.mutateAsync({
            authorizationCodeId: target.authorizationCodeId,
            clientId: target.clientId,
          }),
      }),
    )
    setFeedback(result)
    setConfirming(null)
    if (result._tag === "Revoked") {
      setSelected(null)
    }
  }
  return {
    list,
    selected,
    setSelected,
    feedback,
    setFeedback,
    confirming,
    setConfirming,
    listRegion,
    focusDetail,
    returnFocus,
    detail,
    names,
    connections,
    listRecovery,
    owned,
    message,
    busy,
    refreshFeedback,
    confirmRevoke,
  }
}
