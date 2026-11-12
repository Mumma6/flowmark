"use client"

import Link from "next/link"
import { useQueryClient } from "@tanstack/react-query"
import { Result, Array } from "effect"
import { useRouter } from "next/navigation"
import { useRef, useState } from "react"
import {
  Alert,
  AlertDescription,
  Button,
  Input,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@flowmark/ui"
import { authClient } from "../../auth/auth-client"
import { runBrowserAuth } from "../../auth/auth-browser-runtime"
import { signOut } from "../../auth/operations"
import { useAccountSessions } from "./use-account-sessions"

function Sessions({ ownerId }: { readonly ownerId: string }) {
  const controls = useAccountSessions(ownerId)
  const heading = useRef<HTMLHeadingElement>(null)
  const cache = useQueryClient()
  const router = useRouter()
  const [password, setPassword] = useState("")
  const [signingOut, setSigningOut] = useState(false)
  const [signOutError, setSignOutError] = useState<string | null>(null)
  const otherCount = Array.filter(
    controls.sessions.data ?? [],
    (session) => !session.current,
  ).length
  async function signOutCurrent() {
    if (signingOut) {
      return
    }
    setSigningOut(true)
    setSignOutError(null)
    Result.match(await runBrowserAuth(signOut()), {
      onFailure: (failure) => {
        setSignOutError(failure.reason)
        setSigningOut(false)
      },
      onSuccess: () => {
        cache.clear()
        router.replace("/sign-in")
        router.refresh()
      },
    })
  }
  return (
    <section className="grid gap-4" aria-labelledby="account-sessions-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2
          id="account-sessions-heading"
          ref={heading}
          tabIndex={-1}
          className="font-medium"
        >
          Active sessions
        </h2>
        <Button
          variant="outline"
          disabled={controls.sessions.isFetching || controls.pending}
          onClick={() => {
            void controls.sessions.refetch()
          }}
        >
          Refresh sessions
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        Device names are approximate. Times show when a session was created or
        updated, not proof of recent activity. Session sign-out does not revoke
        separately granted agent connections or project keys.
      </p>
      {controls.saved ? (
        <p role="status" className="text-sm">
          {controls.saved}
        </p>
      ) : null}
      {!controls.target && controls.error ? (
        <Alert variant="destructive">
          <AlertDescription>{controls.error}</AlertDescription>
        </Alert>
      ) : null}
      {signOutError ? (
        <Alert variant="destructive">
          <AlertDescription>{signOutError}</AlertDescription>
        </Alert>
      ) : null}
      {controls.sessions.isPending ? (
        <p role="status">Loading active sessions…</p>
      ) : controls.sessions.isError ? (
        <Alert variant="destructive">
          <AlertDescription>
            {controls.sessions.error.message}{" "}
            <Button
              variant="outline"
              disabled={signingOut || controls.pending}
              onClick={signOutCurrent}
            >
              {signingOut ? "Signing out…" : "Sign out and sign in again"}
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
        <>
          {!controls.sessions.data.length ? (
            <p role="status">
              No active sessions were returned. Refresh or sign in again.
            </p>
          ) : (
            <ul className="grid gap-3">
              {controls.sessions.data.map((session) => (
                <li
                  key={session.id}
                  className="flex min-w-0 flex-wrap items-start justify-between gap-3 rounded-lg border border-border p-4"
                >
                  <div className="grid min-w-0 gap-1 text-sm">
                    <p className="font-medium">
                      {session.device}
                      {session.current ? " · This session" : ""}
                    </p>
                    <p className="break-words text-muted-foreground">
                      Signed in{" "}
                      <time dateTime={session.createdAt}>
                        {new Date(session.createdAt).toLocaleString()}
                      </time>
                    </p>
                    <p className="break-words text-muted-foreground">
                      Updated{" "}
                      <time dateTime={session.updatedAt}>
                        {new Date(session.updatedAt).toLocaleString()}
                      </time>
                    </p>
                    <p className="break-words text-muted-foreground">
                      Expires{" "}
                      <time dateTime={session.expiresAt}>
                        {new Date(session.expiresAt).toLocaleString()}
                      </time>
                    </p>
                  </div>
                  {session.current ? (
                    <Button
                      variant="outline"
                      disabled={signingOut || controls.pending}
                      onClick={signOutCurrent}
                    >
                      {signingOut ? "Signing out…" : "Sign out on this device"}
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      disabled={controls.pending || signingOut}
                      aria-label={`Sign out ${session.device}`}
                      onClick={() => {
                        setPassword("")
                        controls.select({
                          kind: "single",
                          sessionId: session.id,
                        })
                      }}
                    >
                      Sign out session
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
          <div>
            <Button
              variant="outline"
              disabled={
                otherCount === 0 ||
                controls.pending ||
                signingOut ||
                controls.sessions.isFetching
              }
              onClick={() => {
                setPassword("")
                controls.select({ kind: "others" })
              }}
            >
              Sign out all other sessions
            </Button>
          </div>
        </>
      )}
      <Dialog
        open={controls.target !== null}
        onOpenChange={(open) => {
          if (!open && !controls.pending) {
            setPassword("")
            controls.select(null)
          }
        }}
      >
        <DialogContent showCloseButton={!controls.pending} finalFocus={heading}>
          <DialogHeader>
            <DialogTitle>
              {controls.target?.kind === "others"
                ? "Sign out all other sessions?"
                : "Sign out this session?"}
            </DialogTitle>
            <DialogDescription>
              Your current session stays signed in. Confirm your password to
              revoke the selected access. Agent connections and project keys are
              separate.
            </DialogDescription>
          </DialogHeader>
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault()
              const submitted = password
              setPassword("")
              controls.confirm(submitted)
            }}
          >
            {controls.error ? (
              <Alert variant="destructive" role="alert">
                <AlertDescription>{controls.error}</AlertDescription>
              </Alert>
            ) : null}
            <label className="grid gap-2 text-sm">
              <span>Current password for session sign-out</span>
              <Input
                type="password"
                autoComplete="current-password"
                required
                maxLength={1024}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={controls.pending}
              />
            </label>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={controls.pending}
                onClick={() => {
                  setPassword("")
                  controls.select(null)
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="destructive"
                disabled={!password || controls.pending}
              >
                {controls.pending ? "Signing out…" : "Confirm session sign-out"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  )
}

export function AccountSessionsPanel() {
  const session = authClient.useSession()
  if (session.isPending) {
    return <p role="status">Checking your session…</p>
  }
  if (session.error || !session.data) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Your session is unavailable.{" "}
          <Link href="/sign-in" className="underline">
            Sign in again
          </Link>
        </AlertDescription>
      </Alert>
    )
  }
  return <Sessions key={session.data.user.id} ownerId={session.data.user.id} />
}
