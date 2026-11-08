"use client"

import {
  Alert,
  AlertDescription,
  Button,
  Checkbox,
  FlowmarkMark,
} from "@flowmark/ui"
import { useQuery, type UseQueryResult } from "@tanstack/react-query"
import { Array, Effect, Result } from "effect"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useState } from "react"
import {
  readConsentView,
  submitConsentView,
  type ConsentView,
} from "./consent-browser"
import { runBrowserAuth } from "../auth/auth-browser-runtime"
import { signOut } from "../auth/operations"

export function AgentConsentPage() {
  const params = useSearchParams()
  const oauthQuery = params.toString()
  const query = useQuery({
    queryKey: ["agent-consent", oauthQuery],
    queryFn: ({ signal }) => readConsentView(oauthQuery, signal),
    retry: false,
    staleTime: 0,
    gcTime: 0,
  })
  return (
    <AgentConsentForm
      key={`${oauthQuery}:${query.data?.accountBinding ?? ""}`}
      query={query}
      oauthQuery={oauthQuery}
    />
  )
}

function AgentConsentForm({
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
  return (
    <main className="mx-auto grid min-h-screen max-w-xl content-center gap-6 px-5 py-12">
      <FlowmarkMark className="size-10 text-primary" />
      <div>
        <p className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">
          Flowmark / Agent access
        </p>
        <h1 className="text-3xl font-medium tracking-tight">
          Review read access
        </h1>
      </div>
      {query.isPending ? (
        <p role="status">Loading the authorization request…</p>
      ) : null}
      {query.error ? (
        <Alert variant="destructive">
          <AlertDescription>
            We could not open this authorization. Sign in with the intended
            account, reload, or restart from your client.
          </AlertDescription>
        </Alert>
      ) : null}
      {query.error ? (
        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href={`/connect/agent/sign-in?${oauthQuery}`}>Sign in</Link>
          </Button>
          <Button variant="outline" onClick={() => void query.refetch()}>
            Reload request
          </Button>
        </div>
      ) : null}
      {query.data && !query.error ? (
        <>
          <section className="grid gap-3 rounded-xl border border-border bg-card p-5">
            <h2 className="text-lg font-medium break-words">
              {query.data.clientName ?? "OAuth client"}
            </h2>
            <p className="break-all font-mono text-xs text-muted-foreground">
              {query.data.clientId}
            </p>
            <p className="text-sm leading-6">
              Can read recorded telemetry in the projects you select.
              Application-selected context may contain sensitive information.
            </p>
            {query.data.scopes.includes("offline_access") ? (
              <p className="text-sm text-muted-foreground">
                Persistent access is requested. The client can refresh access
                until the connection expires or is revoked.
              </p>
            ) : null}
          </section>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="break-all text-sm">
              Signed in as <strong>{query.data.account.email}</strong>
            </p>
            <Button
              variant="ghost"
              disabled={pending}
              onClick={async () => {
                setPending(true)
                const signedOut = await runBrowserAuth(signOut())
                if (Result.isFailure(signedOut)) {
                  setPending(false)
                  setError("Could not sign out. Please retry.")
                  return
                }
                setProjects([])
                window.location.assign(`/connect/agent/sign-in?${oauthQuery}`)
              }}
            >
              Use another account
            </Button>
          </div>
          <fieldset disabled={pending} className="grid gap-3">
            <legend className="mb-3 text-sm font-medium">
              Select projects · {projects.length}/10
            </legend>
            {query.data.projects.length ? (
              query.data.projects.map((project) => (
                <label
                  key={project.id}
                  className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border border-border p-3 text-sm"
                >
                  <Checkbox
                    checked={projects.includes(project.id)}
                    disabled={
                      !projects.includes(project.id) && projects.length >= 10
                    }
                    onCheckedChange={(checked) =>
                      setProjects((current) =>
                        checked === true
                          ? [...current, project.id]
                          : Array.filter(current, (id) => id !== project.id),
                      )
                    }
                  />
                  <span className="break-words">{project.name}</span>
                </label>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                This account has no projects to authorize. Create a project in
                Studio, then restart this request.
              </p>
            )}
          </fieldset>
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <div className="flex flex-wrap gap-3">
            <Button
              disabled={pending || query.isFetching || projects.length === 0}
              onClick={() => void submit(true)}
            >
              {pending ? "Submitting…" : "Allow read access"}
            </Button>
            <Button
              variant="outline"
              disabled={pending}
              onClick={() => void submit(false)}
            >
              Deny and return to client
            </Button>
            <Button asChild variant="ghost">
              <Link href="/connect">Cancel</Link>
            </Button>
          </div>
          <p className="text-xs leading-6 text-muted-foreground">
            This does not create an ingestion key or let the agent execute
            application work. Signing out of Studio does not revoke existing
            agent connections.
          </p>
        </>
      ) : null}
    </main>
  )
}
