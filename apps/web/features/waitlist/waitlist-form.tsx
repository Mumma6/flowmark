"use client"

import { Button, FlowmarkMark, Input } from "@flowmark/ui"
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
      <p
        role="alert"
        className="mx-auto mt-8 max-w-lg rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground"
      >
        The waitlist is temporarily unavailable. Please try again later.
      </p>
    )
  }
  if (success) {
    return (
      <div
        role="status"
        tabIndex={-1}
        ref={(node) => node?.focus()}
        className="mx-auto mt-9 max-w-lg rounded-xl border border-primary/25 bg-primary/5 p-7 text-left motion-safe:animate-arrive"
      >
        <div className="flex items-center gap-3">
          <FlowmarkMark className="size-6 text-primary" />
          <p className="text-lg font-medium text-primary">
            You’re on the list.
          </p>
        </div>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Your request has been received. Thanks for your interest in Flowmark.
        </p>
      </div>
    )
  }
  return (
    <form
      onSubmit={submit}
      aria-busy={pending}
      className="mx-auto mt-9 grid max-w-lg gap-3 text-left"
    >
      <label htmlFor={id} className="text-sm font-medium">
        Your email address
      </label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Input
          id={id}
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@company.com"
          required
          maxLength={254}
          autoCapitalize="none"
          spellCheck={false}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={pending}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-note ${id}-error` : `${id}-note`}
          className="h-12 min-w-0 rounded-lg bg-card sm:flex-1"
        />
        <Button
          type="submit"
          disabled={pending}
          className="h-12 w-full rounded-lg px-5 text-xs sm:w-auto"
        >
          {pending ? "Joining…" : "Join the Waitlist"}
        </Button>
      </div>
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <p
        id={`${id}-note`}
        className="text-center text-[11px] leading-6 text-muted-foreground"
      >
        Join for early access. Just your email, no account needed.
      </p>
    </form>
  )
}
