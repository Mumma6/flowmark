"use client"

import { Alert, AlertDescription, Button, Input } from "@flowmark/ui"
import { Result } from "effect"
import { useState, type FormEvent } from "react"
import { runBrowserAuth } from "../auth/auth-browser-runtime"
import { changeAccountPassword } from "../auth/operations"

export function AccountPasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) {
      return
    }
    setPending(true)
    setError(null)
    setSaved(null)
    const result = await runBrowserAuth(
      changeAccountPassword({ currentPassword, newPassword }),
    )
    Result.match(result, {
      onFailure: (failure) => setError(failure.reason),
      onSuccess: () => {
        setCurrentPassword("")
        setNewPassword("")
        setSaved("Password updated. Your other sessions have been signed out.")
      },
    })
    setPending(false)
  }

  return (
    <form
      className="grid gap-3 sm:max-w-md"
      onSubmit={submit}
      aria-busy={pending}
    >
      {error ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {saved ? (
        <p className="text-sm text-muted-foreground" role="status">
          {saved}
        </p>
      ) : null}
      <label className="grid gap-2 text-sm" htmlFor="account-current-password">
        <span className="font-medium">Current password</span>
        <Input
          id="account-current-password"
          name="current-password"
          type="password"
          autoComplete="current-password"
          value={currentPassword}
          disabled={pending}
          aria-invalid={Boolean(error)}
          onChange={(event) => {
            setCurrentPassword(event.target.value)
            setError(null)
            setSaved(null)
          }}
          required
        />
      </label>
      <label className="grid gap-2 text-sm" htmlFor="account-new-password">
        <span className="font-medium">New password</span>
        <Input
          id="account-new-password"
          name="new-password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          maxLength={128}
          value={newPassword}
          disabled={pending}
          aria-invalid={Boolean(error)}
          onChange={(event) => {
            setNewPassword(event.target.value)
            setError(null)
            setSaved(null)
          }}
          required
        />
      </label>
      <p className="text-sm text-muted-foreground">
        Changing your password signs out your other sessions.
      </p>
      <Button type="submit" className="justify-self-start" disabled={pending}>
        {pending ? "Updating…" : "Change password"}
      </Button>
    </form>
  )
}
