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
import Link from "next/link"
import {
  coarsenLastAuthenticated,
  connectionListRecovery,
  connectionProjectLabels,
} from "./connection-revocation"
import { useAgentConnections } from "./use-agent-connections"

export function AgentConnections() {
  const {
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
  } = useAgentConnections()

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
      <CardContent>
        <div
          role="region"
          aria-label="Agent connections"
          ref={listRegion}
          tabIndex={-1}
          className="grid gap-4 outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {list.isPending ? (
            <p className="text-sm text-muted-foreground">
              Loading connections…
            </p>
          ) : null}
          {listRecovery ? (
            <Alert>
              <AlertTitle>
                {listRecovery._tag === "StaleSession"
                  ? "Sign in again"
                  : "Connections are unavailable"}
              </AlertTitle>
              <AlertDescription>
                {listRecovery.message}
                {listRecovery._tag === "StaleSession" ? (
                  <Button asChild size="sm" className="mt-3 min-h-10">
                    <Link href="/sign-in">Sign in</Link>
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="mt-3 min-h-10"
                    onClick={() => void list.refetch()}
                  >
                    Retry
                  </Button>
                )}
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
                className="grid min-w-0 gap-2 rounded-lg border border-border p-4"
              >
                <p className="text-sm font-medium break-words text-foreground">
                  {connection.clientName ?? "Unnamed client"}
                </p>
                <p className="break-all text-xs text-muted-foreground">
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
                    className="min-h-10"
                    onClick={() => {
                      setSelected(connection)
                    }}
                  >
                    Inspect
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="min-h-10"
                    onClick={(event) => {
                      returnFocus.current = event.currentTarget
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
          {owned._tag === "Loading" ? (
            <p role="status" className="text-sm text-muted-foreground">
              Loading connection detail…
            </p>
          ) : null}
          {owned._tag === "Unavailable" ? (
            <Alert>
              <AlertTitle>Connection detail is unavailable</AlertTitle>
              <AlertDescription>
                {connectionListRecovery(detail.error).message}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="mt-3 min-h-10"
                  onClick={() => void detail.refetch()}
                >
                  Retry detail
                </Button>
              </AlertDescription>
            </Alert>
          ) : null}
          {owned._tag === "Owned" && detail.data ? (
            <div
              key={`${selected?.clientId}:${selected?.authorizationCodeId}`}
              ref={focusDetail}
              tabIndex={-1}
              className="grid gap-1 text-sm leading-6 text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
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
              <AlertDescription>
                {message}
                {feedback._tag === "Unknown" ||
                feedback._tag === "StillActive" ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-3 min-h-10"
                    disabled={busy}
                    onClick={() => void refreshFeedback()}
                  >
                    Refresh connections
                  </Button>
                ) : null}
              </AlertDescription>
            </Alert>
          ) : null}
        </div>
      </CardContent>
      <Dialog
        open={confirming !== null}
        disablePointerDismissal={busy}
        onOpenChange={(open) => {
          if (!open && !busy) {
            setConfirming(null)
          }
        }}
      >
        <DialogContent
          showCloseButton={!busy}
          finalFocus={() =>
            returnFocus.current?.isConnected
              ? returnFocus.current
              : listRegion.current
          }
        >
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
              disabled={busy}
              onClick={() => setConfirming(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={busy}
              onClick={() => void confirmRevoke()}
            >
              {busy ? "Confirming revocation…" : "Revoke connection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
