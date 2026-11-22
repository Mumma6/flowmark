"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@flowmark/ui"
import { useQuery } from "@tanstack/react-query"
import { useSyncExternalStore } from "react"
import { useTRPCClient } from "../../platform/api-trpc"
import { DataState } from "../../shared/dashboard-components"

function subscribe(onChange: () => void) {
  window.addEventListener("hashchange", onChange)
  return () => window.removeEventListener("hashchange", onChange)
}

export function RuntimeCitation() {
  const handle = useSyncExternalStore(
    subscribe,
    () => window.location.hash.slice(1),
    () => "",
  )
  const client = useTRPCClient()
  const citation = useQuery({
    queryKey: ["runtime-citation", handle],
    queryFn: ({ signal }) => client.run.citation.mutate({ handle }, { signal }),
    enabled: handle.length > 0,
    gcTime: 0,
    retry: false,
  })
  const result = citation.data

  return (
    <section className="mx-auto grid w-full max-w-4xl gap-6 p-6">
      <h1 className="text-2xl font-semibold">Cited runtime evidence</h1>
      {!handle && <p>Open the complete citation link from the pull request.</p>}
      <DataState pending={citation.isLoading} error={citation.error} />
      {result?.status === "expired-or-invalid" && (
        <p>
          This citation has expired or is invalid. Ask the agent for a fresh
          citation.
        </p>
      )}
      {result?.status === "evidence-unavailable" && (
        <p>
          Some cited evidence is no longer available. Ask the agent for a fresh
          citation.
        </p>
      )}
      {result?.status === "exact" && !citation.error && (
        <>
          <div className="grid gap-1 text-sm text-muted-foreground">
            <p>
              {result.environment} · {result.probe.probeId}
            </p>
            <p className="break-all">Revision {result.revision}</p>
            <p className="break-all">Artifact {result.probe.artifactDigest}</p>
            <p>Selection captured at {result.asOf}.</p>
            <p>
              {result.matchedRuns} matched executions from {result.startedAfter}{" "}
              to {result.startedBefore}.
            </p>
            {result.sampleIncomplete && (
              <p>The original sample was incomplete.</p>
            )}
          </div>
          {result.examples.map((example) => (
            <Card key={example.runId}>
              <CardHeader>
                <CardTitle className="capitalize">
                  {example.selection} execution
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm">
                <p>
                  {example.startedAt} · {example.status}
                  {example.outcome && ` · ${example.outcome}`}
                </p>
                <ol className="grid gap-3">
                  {example.events.map(
                    ({
                      id,
                      step,
                      type,
                      timestamp,
                      runtimeObservation: { observation },
                    }) => (
                      <li key={id} className="grid gap-1 border-l pl-3">
                        <p className="font-medium">{step ?? type}</p>
                        <time
                          className="text-muted-foreground"
                          dateTime={timestamp}
                        >
                          {timestamp}
                        </time>
                        {observation.kind === "loss" ? (
                          <p>{observation.count} observations reported lost</p>
                        ) : (
                          <ul className="grid gap-1 text-muted-foreground">
                            {observation.references.map(
                              ({ kind, namespace, digest }, index) => (
                                <li className="break-all" key={index}>
                                  {kind} · {namespace} · {digest}
                                </li>
                              ),
                            )}
                          </ul>
                        )}
                      </li>
                    ),
                  )}
                </ol>
              </CardContent>
            </Card>
          ))}
        </>
      )}
    </section>
  )
}
