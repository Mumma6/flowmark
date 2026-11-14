"use client"

import { Button, Input } from "@flowmark/ui"
import { Effect, Result } from "effect"
import { useId, useState, type FormEvent } from "react"
import { submitWaitlist } from "./join-waitlist"

export function WaitlistForm({
  endpoint,
}: {
  readonly endpoint: string | undefined
}) {
  const id = useId()
  const [email, setEmail] = useState("")
  const [pending, setPending] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending || !endpoint) {
      return
    }
    setPending(true)
    setError(null)
    const result = await Effect.runPromise(
      Effect.result(submitWaitlist(endpoint, email)),
    )
    Result.match(result, {
      onFailure: (failure) => setError(failure.message),
      onSuccess: () => setSuccess(true),
    })
    setPending(false)
  }
  if (!endpoint) {
    return (
      <p role="alert" className="mt-8 text-sm text-muted-foreground">
        The waitlist is temporarily unavailable. Please try again later.
      </p>
    )
  }
  if (success) {
    return (
      <p role="status" className="mx-auto mt-8 max-w-lg text-sm text-primary">
        You’re on the waitlist. Thanks for your interest in Flowmark.
      </p>
    )
  }
  return (
    <form
      onSubmit={submit}
      aria-busy={pending}
      className="mx-auto mt-8 grid max-w-lg gap-3 text-left"
    >
      <label htmlFor={id} className="text-sm font-medium">
        Join the waitlist for hosted Flowmark
      </label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Input
          id={id}
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          required
          maxLength={254}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={pending}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          className="h-11 bg-background sm:flex-1"
        />
        <Button
          type="submit"
          disabled={pending}
          className="h-11 w-full px-5 sm:w-auto"
        >
          {pending ? "Joining…" : "Join the Waitlist"}
        </Button>
      </div>
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </form>
  )
}
