"use client"
import { Alert, AlertDescription, Button, Checkbox, Input } from "@flowmark/ui"
import { Result, Effect, Redacted } from "effect"
import { useState } from "react"
import { authClient } from "../../auth/auth-client"
import { prepareEmailChange } from "./form-model"
import { useEmailChange } from "./use-email-change"

function EmailChangeForm({
  userId,
  currentSessionId,
  currentEmail,
  refreshIdentity,
}: {
  readonly userId: string
  readonly currentSessionId: string
  readonly currentEmail: string
  readonly refreshIdentity: () => Promise<unknown>
}) {
  const controls = useEmailChange(userId, currentSessionId)
  const [email, setEmail] = useState("")
  const [confirmation, setConfirmation] = useState("")
  const [password, setPassword] = useState("")
  const [understood, setUnderstood] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const available = controls.status.data?.available ?? false
  const active = controls.status.data?.active
  const busy = controls.pending
  return (
    <section className="grid gap-4" aria-labelledby="email-change-heading">
      <h3 id="email-change-heading" className="font-medium">
        Change email address
      </h3>
      <p className="text-sm text-muted-foreground">
        Approve the change at your current verified address, then verify the new
        address. The request expires after 30 minutes. Completing both steps
        signs out all browser sessions and agent connections; project keys and
        ownership stay unchanged.
      </p>
      {controls.status.isPending ? (
        <p role="status">Loading email-change status…</p>
      ) : controls.status.isError ? (
        <Alert variant="destructive">
          <AlertDescription>{controls.status.error.message}</AlertDescription>
        </Alert>
      ) : (
        <>
          {!controls.status.data.available ? (
            <Alert>
              <AlertDescription>
                Email changes are temporarily unavailable. Your existing address
                has not changed.
              </AlertDescription>
            </Alert>
          ) : null}
          {!controls.status.data.verified ? (
            <p className="text-sm">
              Verify your current address above before requesting a change. If
              you cannot access that inbox, use the maintainer’s support
              process; there is no automatic verification bypass.
            </p>
          ) : null}
          {active ? (
            <div className="grid gap-3 rounded-lg border border-border p-4">
              <p className="break-all text-sm">
                Pending address: <strong>{active.toEmail}</strong>
              </p>
              <p role="status" className="text-sm">
                {active.step === "confirm-old"
                  ? "Waiting for approval at your current address. If the new address cannot be used, no approval email will arrive."
                  : "Current address approved. Waiting for verification at the new address."}
              </p>
              <p className="text-sm text-muted-foreground">
                Expires{" "}
                <time dateTime={active.expiresAt}>
                  {new Date(active.expiresAt).toLocaleString()}
                </time>
                . A new password-confirmed request replaces this one and
                invalidates its links.
              </p>
              {active.delivery === "failed" ? (
                <Alert variant="destructive">
                  <AlertDescription>
                    Mail submission could not be confirmed. Cancel or start a
                    new request if no usable message arrived.
                  </AlertDescription>
                </Alert>
              ) : null}
              <div>
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => controls.cancel(active.id)}
                >
                  Cancel pending email change
                </Button>
              </div>
            </div>
          ) : null}
          {controls.status.data.available && controls.status.data.verified ? (
            <form
              className="grid max-w-md gap-4"
              aria-busy={busy}
              onSubmit={(event) => {
                event.preventDefault()
                if (busy) {
                  return
                }
                setFormError(null)
                controls.clearFeedback()
                const submitted = password
                setPassword("")
                const prepared = Effect.runSync(
                  prepareEmailChange({
                    currentEmail,
                    newEmail: email,
                    confirmation,
                    password: submitted,
                  }).pipe(Effect.result),
                )
                Result.match(prepared, {
                  onFailure: (failure) => {
                    setFormError(failure.message)
                  },
                  onSuccess: (value) => {
                    setUnderstood(false)
                    controls.request({
                      newEmail: value.newEmail,
                      password: Redacted.value(value.password),
                    })
                  },
                })
              }}
            >
              <label className="grid gap-2 text-sm">
                <span>New email address</span>
                <Input
                  type="email"
                  autoComplete="email"
                  maxLength={254}
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  disabled={busy}
                />
              </label>
              <label className="grid gap-2 text-sm">
                <span>Confirm new email address</span>
                <Input
                  type="email"
                  autoComplete="off"
                  maxLength={254}
                  required
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  disabled={busy}
                />
              </label>
              <label className="grid gap-2 text-sm">
                <span>Current password for email change</span>
                <Input
                  type="password"
                  autoComplete="current-password"
                  maxLength={1024}
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={busy}
                />
              </label>
              <label className="flex items-start gap-3 text-sm">
                <Checkbox
                  checked={understood}
                  onCheckedChange={(checked) => setUnderstood(checked === true)}
                  disabled={busy}
                />
                <span>
                  I can access both inboxes and understand that completion signs
                  out my sessions and agent connections.
                </span>
              </label>
              <div>
                <Button
                  type="submit"
                  disabled={
                    busy || !understood || !password || !email || !confirmation
                  }
                >
                  {busy
                    ? "Requesting change…"
                    : active
                      ? "Replace pending request"
                      : "Request email change"}
                </Button>
              </div>
            </form>
          ) : null}
          {controls.status.data.notices.map((notice) => (
            <div
              key={notice.id}
              className="grid gap-3 rounded-lg border border-border p-4"
            >
              <p className="text-sm">
                A completed change has an unconfirmed security notice to the
                previous address. The profile change is already complete.
              </p>
              <div>
                <Button
                  variant="outline"
                  disabled={busy || !available}
                  onClick={() => controls.retry(notice.id)}
                >
                  Retry previous-address notice
                </Button>
              </div>
            </div>
          ))}
        </>
      )}
      {formError || controls.error ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{formError ?? controls.error}</AlertDescription>
        </Alert>
      ) : null}
      {controls.message ? (
        <p role="status" className="text-sm">
          {controls.message}
        </p>
      ) : null}
      <div>
        <Button
          variant="outline"
          disabled={busy || controls.status.isFetching}
          onClick={async () => {
            await refreshIdentity()
            await controls.status.refetch()
          }}
        >
          Refresh account and change status
        </Button>
      </div>
    </section>
  )
}
export function EmailChangePanel() {
  const identity = authClient.useSession()
  if (identity.isPending) {
    return <p role="status">Checking account identity…</p>
  }
  if (identity.error || !identity.data) {
    return (
      <p role="alert">
        Your account session is unavailable. Sign in again to manage your email.
      </p>
    )
  }
  const { user, session } = identity.data
  return (
    <EmailChangeForm
      key={`${user.id}:${session.id}`}
      userId={user.id}
      currentSessionId={session.id}
      currentEmail={user.email}
      refreshIdentity={() => identity.refetch()}
    />
  )
}
