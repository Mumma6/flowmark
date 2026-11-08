"use client"

import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@flowmark/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Array as EffectArray, Match } from "effect"
import { useState } from "react"
import { useTRPC } from "../platform/api-trpc"
import { useProject } from "../projects/project-context"
import {
  coarsenLastAuthenticated,
  connectionProjectLabels,
  interpretOwnedConnection,
  interpretRevokeResult,
  type RevokeFeedback,
} from "./connection-revocation"

type ListedConnection = {
  readonly authorizationCodeId: string
  readonly clientId: string
  readonly clientName: string | null
  readonly projectIds: readonly string[]
  readonly lastAuthenticatedAt: string | null
}

const feedbackCopy = (feedback: RevokeFeedback) =>
  Match.value(feedback).pipe(
    Match.tag(
      "Revoked",
      () =>
        "Revoked. The next read with that grant is denied. Connect again from the client to create a new grant; this one is not restored.",
    ),
    Match.tag(
      "StillActive",
      () =>
        "Revocation did not change the stored grant. The connection is still authorized.",
    ),
    Match.tag(
      "Unknown",
      () =>
        "The response was lost. Refresh this list before revoking again. Do not assume the grant changed.",
    ),
    Match.orElse(() => null),
  )

export function AgentConnections() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const { projects } = useProject()
  const list = useQuery(trpc.agentAccess.list.queryOptions())
  const [selected, setSelected] = useState<ListedConnection | null>(null)
  const [feedback, setFeedback] = useState<RevokeFeedback>({ _tag: "Idle" })
  const [confirming, setConfirming] = useState<ListedConnection | null>(null)
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
  const connections = list.data ?? []
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
            ? "present"
            : detail.data
              ? "present"
              : "absent",
      })
    : { _tag: "Hidden" as const }
  const message = feedbackCopy(feedback)

  const confirmRevoke = async () => {
    if (!confirming || revoke.isPending) {
      return
    }
    const target = confirming
    setFeedback({ _tag: "Pending" })
    let mutation: "succeeded" | "failed" = "failed"
    try {
      await revoke.mutateAsync({
        authorizationCodeId: target.authorizationCodeId,
        clientId: target.clientId,
      })
      mutation = "succeeded"
    } catch {
      mutation = "failed"
    }
    let stillListed: boolean | "unknown" = "unknown"
    try {
      const next = await queryClient.fetchQuery(
        trpc.agentAccess.list.queryOptions(),
      )
      stillListed = EffectArray.some(
        next,
        (item) =>
          item.authorizationCodeId === target.authorizationCodeId &&
          item.clientId === target.clientId,
      )
    } catch {
      stillListed = "unknown"
    }
    const result = interpretRevokeResult({ mutation, stillListed })
    setFeedback(result)
    setConfirming(null)
    if (result._tag === "Revoked") {
      setSelected(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your connections</CardTitle>
        <CardDescription>
          These are grants for the signed-in account. Signing out of Studio ends
          this browser session and does not revoke them. Changing the project
          list means revoke, then connect again.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {list.isPending ? (
          <p className="text-sm text-muted-foreground">Loading connections…</p>
        ) : null}
        {list.isError ? (
          <Alert>
            <AlertTitle>Connections are unavailable</AlertTitle>
            <AlertDescription>
              The list could not be read. Retry before revoking anything.
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="mt-3"
                onClick={() => void list.refetch()}
              >
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}
        {!list.isPending && !list.isError && connections.length === 0 ? (
          <p className="text-sm leading-6 text-muted-foreground">
            No active connections. An expired or revoked grant is not listed.
            Connect again from your client. That creates a new grant and does
            not restore the old one.
          </p>
        ) : null}
        <ul className="grid gap-3">
          {connections.map((connection) => (
            <li
              key={`${connection.clientId}:${connection.authorizationCodeId}`}
              className="grid gap-2 rounded-lg border border-border p-4"
            >
              <p className="text-sm font-medium text-foreground">
                {connection.clientName ?? "Unnamed client"}
              </p>
              <p className="text-xs text-muted-foreground">
                Client identifier {connection.clientId}
              </p>
              <p className="text-sm text-muted-foreground">
                Projects:{" "}
                {connectionProjectLabels(connection.projectIds, names).join(
                  ", ",
                )}
              </p>
              <p className="text-sm text-muted-foreground">
                {coarsenLastAuthenticated(connection.lastAuthenticatedAt)}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setSelected(connection)}
                >
                  Inspect
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    setFeedback({ _tag: "Idle" })
                    setConfirming(connection)
                  }}
                >
                  Revoke
                </Button>
              </div>
            </li>
          ))}
        </ul>
        {owned._tag === "Owned" && detail.data ? (
          <div className="grid gap-1 text-sm leading-6 text-muted-foreground">
            <p className="font-medium text-foreground">Connection detail</p>
            <p>
              {detail.data.clientName ?? "Unnamed client"} ·{" "}
              {detail.data.clientId}
            </p>
            <p>
              {connectionProjectLabels(detail.data.projectIds, names).join(
                ", ",
              )}
            </p>
            <p>{coarsenLastAuthenticated(detail.data.lastAuthenticatedAt)}</p>
          </div>
        ) : null}
        {owned._tag === "UnavailableToAccount" ? (
          <Alert>
            <AlertTitle>Connection not available</AlertTitle>
            <AlertDescription>
              The signed-in account cannot read that connection. It may belong
              to someone else or already be revoked.
            </AlertDescription>
          </Alert>
        ) : null}
        {message ? (
          <Alert>
            <AlertTitle>
              {feedback._tag === "Revoked"
                ? "Revocation confirmed"
                : "Revocation not confirmed"}
            </AlertTitle>
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        ) : null}
      </CardContent>
      <Dialog
        open={confirming !== null}
        disablePointerDismissal={revoke.isPending}
        onOpenChange={(open) => {
          if (!open && !revoke.isPending) {
            setConfirming(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke this connection</DialogTitle>
            <DialogDescription>
              {confirming
                ? `Revoke ${confirming.clientName ?? "this client"} (${confirming.clientId}). Projects: ${connectionProjectLabels(confirming.projectIds, names).join(", ")}. The next read is denied. Reconnect creates a new grant. This is not a device or a running process.`
                : "Revoke the selected connection."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={revoke.isPending}
              onClick={() => setConfirming(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={revoke.isPending}
              onClick={() => void confirmRevoke()}
            >
              {revoke.isPending ? "Revoking…" : "Revoke connection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
