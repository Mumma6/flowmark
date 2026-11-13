"use client"

import { Effect, Result } from "effect"
import { useState } from "react"
import { runBrowserAuth } from "../auth-browser-runtime"
import {
  DashboardAuthError,
  requestAccountEmailVerification,
} from "../operations"

export type EmailVerificationProps = {
  readonly returnTo?: string
  readonly user: {
    readonly email: string
    readonly emailVerified: boolean
  } | null
  readonly loading: boolean
  readonly sessionError: boolean
  readonly linkFailed: boolean
  readonly refresh: () => Promise<unknown>
}

export function useEmailVerification({
  user,
  refresh,
  returnTo,
}: Pick<EmailVerificationProps, "user" | "refresh" | "returnTo">) {
  const [pending, setPending] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [requested, setRequested] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const busy = pending || refreshing
  async function requestLink() {
    if (busy || !user || user.emailVerified) {
      return
    }
    setError(null)
    setPending(true)
    const result = await runBrowserAuth(
      requestAccountEmailVerification(user.email, returnTo),
    )
    Result.match(result, {
      onSuccess: () => setRequested(true),
      onFailure: (failure) => setError(failure.reason),
    })
    setPending(false)
  }
  async function refreshStatus() {
    if (busy) {
      return
    }
    setRefreshing(true)
    setError(null)
    const result = await Effect.runPromise(
      Effect.tryPromise({
        try: refresh,
        catch: () =>
          new DashboardAuthError({
            operation: "verification-status",
            reason: "Could not refresh your email status. Please try again.",
          }),
      }).pipe(Effect.result),
    )
    Result.match(result, {
      onSuccess: () => undefined,
      onFailure: (failure) => setError(failure.reason),
    })
    setRefreshing(false)
  }
  return {
    pending,
    refreshing,
    requested,
    error,
    busy,
    requestLink,
    refreshStatus,
  }
}
