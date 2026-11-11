"use client"

import { type UseQueryResult } from "@tanstack/react-query"
import { Effect, Result } from "effect"
import { useState } from "react"
import { submitConsentView, type ConsentView } from "./consent-browser"
import { runBrowserAuth } from "../../auth/auth-browser-runtime"
import { signOut } from "../../auth/operations"

export function useAgentConsentForm({
  query,
  oauthQuery,
}: {
  readonly query: UseQueryResult<ConsentView, Error>
  readonly oauthQuery: string
}) {
  const [projects, setProjects] = useState<readonly string[]>([])
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submit = async (accept: boolean) => {
    if (!query.data) {
      return
    }
    setPending(true)
    setError(null)
    const result = await Effect.runPromise(
      Effect.result(
        submitConsentView({
          oauthQuery,
          accountBinding: query.data.accountBinding,
          accept,
          projectIds: accept ? projects : [],
        }),
      ),
    )
    Result.match(result, {
      onSuccess: (url) => window.location.assign(url),
      onFailure: () => {
        setError(
          "Authorization was not completed. Reload this request or restart from your client.",
        )
        setProjects([])
        void query.refetch()
      },
    })
    setPending(false)
  }
  const switchAccount = async () => {
    setPending(true)
    const signedOut = await runBrowserAuth(signOut())
    if (Result.isFailure(signedOut)) {
      setPending(false)
      setError("Could not sign out. Please retry.")
      return
    }
    setProjects([])
    window.location.assign(`/connect/agent/sign-in?${oauthQuery}`)
  }
  return { projects, setProjects, pending, error, submit, switchAccount }
}
