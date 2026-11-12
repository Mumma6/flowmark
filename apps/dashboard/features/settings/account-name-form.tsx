"use client"

import { Alert, AlertDescription, Button, Input } from "@flowmark/ui"
import { Result } from "effect"
import { useEffect, useState, type FormEvent } from "react"
import { runBrowserAuth } from "../auth/auth-browser-runtime"
import { updateAccountName } from "../auth/operations"

export function AccountNameForm({
  sessionName,
}: {
  readonly sessionName: string
}) {
  const [name, setName] = useState(sessionName)
  const [baseline, setBaseline] = useState(sessionName)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const dirty = name !== baseline

  useEffect(() => {
    if (!dirty) {
      setName(sessionName)
      setBaseline(sessionName)
    }
  }, [sessionName, dirty])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) {
      return
    }
    setPending(true)
    setError(null)
    setSaved(null)
    const result = await runBrowserAuth(updateAccountName(name))
    Result.match(result, {
      onFailure: (failure) => setError(failure.reason),
      onSuccess: (savedName) => {
        setName(savedName)
        setBaseline(savedName)
        setSaved("Display name saved.")
      },
    })
    setPending(false)
  }

  return (
    <form
      className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end"
      onSubmit={submit}
      aria-busy={pending}
    >
      {error ? (
        <Alert variant="destructive" role="alert" className="sm:col-span-2">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {saved ? (
        <p className="text-sm text-muted-foreground sm:col-span-2" role="status">
          {saved}
        </p>
      ) : null}
      <label className="grid gap-2 text-sm" htmlFor="account-display-name">
        <span className="font-medium">Name</span>
        <Input
          id="account-display-name"
          name="name"
          autoComplete="name"
          maxLength={128}
          value={name}
          disabled={pending}
          aria-invalid={Boolean(error)}
          onChange={(event) => {
            setName(event.target.value)
            setError(null)
            setSaved(null)
          }}
        />
      </label>
      <Button type="submit" disabled={pending || !dirty}>
        {pending ? "Saving…" : "Save name"}
      </Button>
    </form>
  )
}
