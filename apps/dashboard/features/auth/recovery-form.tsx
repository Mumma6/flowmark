"use client"

import {
  Alert,
  AlertDescription,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
} from "@flowmark/ui"
import { Match, Result } from "effect"
import Link from "next/link"
import { useEffect, useState } from "react"
import {
  completeRecovery,
  requestRecovery,
  type RecoveryError,
} from "./recovery"
import { runRecovery } from "./recovery-browser-runtime"

const errorMessage = (error: RecoveryError, mode: "request" | "reset") =>
  Match.value(error.reason).pipe(
    Match.when("invalid-input", () =>
      mode === "request"
        ? "Enter a valid email address."
        : "Use 8–128 characters and make sure both passwords match.",
    ),
    Match.when(
      "rate-limited",
      () => "Too many requests. Wait a few minutes before trying again.",
    ),
    Match.when(
      "invalid-link",
      () =>
        "This reset link is invalid, expired or already used. Request a new link below.",
    ),
    Match.when(
      "uncertain",
      () =>
        "We could not confirm the result. Try signing in with your new password before requesting another link.",
    ),
    Match.when(
      "unavailable",
      () => "Password recovery is temporarily unavailable. Try again later.",
    ),
    Match.exhaustive,
  )

export function RecoveryForm({
  mode,
  token,
}: {
  readonly mode: "request" | "reset"
  readonly token?: string
}) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmation, setConfirmation] = useState("")
  const [pending, setPending] = useState(false)
  const [complete, setComplete] = useState(false)
  const [uncertain, setUncertain] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [invalid, setInvalid] = useState(mode === "reset" && !token)

  useEffect(() => {
    if (mode === "reset") {
      // Keep a bearer link out of subsequent history/referrers; token stays in memory.
      window.history.replaceState(window.history.state, "", "/reset-password")
    }
  }, [mode])

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending || uncertain) {
      return
    }
    setPending(true)
    setError(null)
    const result =
      mode === "request"
        ? await runRecovery(requestRecovery(email))
        : await runRecovery(
            completeRecovery({ token, newPassword: password, confirmation }),
          )
    Result.match(result, {
      onSuccess: () => {
        setPassword("")
        setConfirmation("")
        setComplete(true)
      },
      onFailure: (failure) => {
        setError(errorMessage(failure, mode))
        if (failure.reason === "invalid-link") {
          setInvalid(true)
          setError(null)
        }
        if (failure.reason === "uncertain") {
          setUncertain(true)
          setPassword("")
          setConfirmation("")
        }
      },
    })
    setPending(false)
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[radial-gradient(ellipse_at_50%_0%,hsl(var(--highlight)/0.06),transparent_60%)] p-6">
      <Card className="w-full max-w-md border-highlight/20">
        <CardHeader>
          <span
            aria-hidden="true"
            className="mb-2 block h-0.5 w-8 rounded-full bg-highlight/70"
          />
          <CardTitle>
            {complete
              ? mode === "request"
                ? "Check your email"
                : "Password updated"
              : mode === "request"
                ? "Forgot password?"
                : "Set a new password"}
          </CardTitle>
          <CardDescription>
            {mode === "request"
              ? "Request a reset link for your Flowmark account."
              : "Choose a new password for your existing Flowmark account."}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5">
          {error ? (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          {complete ? (
            <p className="text-sm text-muted-foreground" role="status">
              {mode === "request"
                ? "If an account matches that address, check your inbox for a reset link. If it does not arrive, check spam or try again later. The link expires after 30 minutes."
                : "Your password has been changed and previous sessions have been signed out. Sign in with your new password."}
            </p>
          ) : invalid ? (
            <Alert role="alert">
              <AlertDescription>
                This reset link is invalid, expired or already used. Request a
                new link to continue.
              </AlertDescription>
            </Alert>
          ) : (
            <form className="grid gap-4" onSubmit={submit} aria-busy={pending}>
              {mode === "request" ? (
                <label className="grid gap-2 text-sm">
                  Email
                  <Input
                    type="email"
                    autoComplete="email"
                    autoFocus
                    maxLength={254}
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    disabled={pending || uncertain}
                  />
                </label>
              ) : (
                <>
                  <label className="grid gap-2 text-sm">
                    New password
                    <Input
                      type="password"
                      autoComplete="new-password"
                      autoFocus
                      minLength={8}
                      maxLength={128}
                      required
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      disabled={pending || uncertain}
                    />
                  </label>
                  <label className="grid gap-2 text-sm">
                    Confirm new password
                    <Input
                      type="password"
                      autoComplete="new-password"
                      minLength={8}
                      maxLength={128}
                      required
                      value={confirmation}
                      onChange={(event) => setConfirmation(event.target.value)}
                      disabled={pending || uncertain}
                    />
                  </label>
                  <p className="text-sm text-muted-foreground">
                    Use 8–128 characters. Your previous sessions will be signed
                    out.
                  </p>
                </>
              )}
              <Button type="submit" disabled={pending || uncertain}>
                {pending
                  ? "Please wait…"
                  : mode === "request"
                    ? "Request reset link"
                    : "Save new password"}
              </Button>
            </form>
          )}
          <nav
            className="flex flex-wrap gap-4 text-sm text-primary"
            aria-label="Account recovery"
          >
            <Link href="/sign-in">Back to sign in</Link>
            {mode === "reset" ? (
              <Link href="/forgot-password">Request a new reset link</Link>
            ) : complete ? (
              <Button
                variant="link"
                className="h-auto p-0"
                onClick={() => {
                  setComplete(false)
                  setError(null)
                }}
              >
                Try another request
              </Button>
            ) : null}
          </nav>
        </CardContent>
      </Card>
    </main>
  )
}
