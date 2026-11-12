"use client"

import { Alert, AlertDescription, Badge, Button } from "@flowmark/ui"
import Link from "next/link"
import {
  useEmailVerification,
  type EmailVerificationProps,
} from "./use-email-verification"

export function EmailVerificationPanel({
  user,
  loading,
  sessionError,
  linkFailed,
  refresh,
}: EmailVerificationProps) {
  const {
    pending,
    refreshing,
    requested,
    error,
    busy,
    requestLink,
    refreshStatus,
  } = useEmailVerification({ user, refresh })

  return (
    <section className="grid gap-3" aria-label="Email verification">
      <h3 className="text-sm font-medium">Email verification</h3>
      {loading ? (
        <p role="status" className="text-sm text-muted-foreground">
          Loading email status…
        </p>
      ) : sessionError ? (
        <Alert variant="destructive">
          <AlertDescription>
            Could not load your email status. Refresh it to try again.
          </AlertDescription>
        </Alert>
      ) : !user ? (
        <p className="text-sm text-muted-foreground">
          Your session has ended.{" "}
          <Link href="/sign-in" className="text-primary underline">
            Sign in again
          </Link>{" "}
          to check your email status.
        </p>
      ) : user.emailVerified ? (
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">Verified</Badge>
          <p role="status" className="text-sm text-muted-foreground">
            Your email address is verified.
          </p>
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            Your email address is not verified. Verification is optional; you
            can keep using Flowmark without it.
          </p>
          {linkFailed && !requested ? (
            <Alert>
              <AlertDescription>
                This verification link could not be used. Request a new link
                below.
              </AlertDescription>
            </Alert>
          ) : null}
          {requested ? (
            <p role="status" className="text-sm text-muted-foreground">
              Verification requested. If your address still needs verification,
              check your inbox and spam folder. The link expires after 30
              minutes. After confirming it, refresh the status below.
            </p>
          ) : null}
          <Button
            type="button"
            className="justify-self-start"
            disabled={busy}
            onClick={requestLink}
          >
            {pending
              ? "Requesting link…"
              : requested
                ? "Request another link"
                : "Verify email"}
          </Button>
        </>
      )}
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {!loading && (user || sessionError) ? (
        <Button
          type="button"
          variant="outline"
          className="justify-self-start"
          disabled={busy}
          onClick={refreshStatus}
        >
          {refreshing ? "Refreshing…" : "Refresh status"}
        </Button>
      ) : null}
    </section>
  )
}
