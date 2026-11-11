"use client"

import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
} from "@flowmark/ui"
import { Array, Option } from "effect"
import { useEffect, useRef } from "react"
import type { JourneyNode, JourneyRunReference } from "@flowmarkdev/core"
import type { JourneySelection } from "./journey-selection"
import { useReferenceJourney } from "./queries"
import { JourneyRunCard } from "./journey-run-card"
import { DataState } from "../shared/dashboard-components"
import { formatTimestamp } from "../shared/format"

export function JourneyEvidence({
  selection,
  from,
  onSelect,
}: {
  selection: JourneySelection
  from: string
  onSelect: (selection: JourneySelection) => void
}) {
  const result = useReferenceJourney(selection)
  const focusNextPage = useRef(false)
  useEffect(() => {
    if (!focusNextPage.current || result.isFetching) {
      return
    }
    focusNextPage.current = false
    if (result.isError) {
      return
    }
    const page = Option.getOrUndefined(Array.last(result.data?.pages ?? []))
    const first =
      page?.state === "Ambiguous" ? page.candidates[0] : page?.nodes[0]
    if (first) {
      document.getElementById(`journey-evidence-${first.id}`)?.focus()
    }
  }, [result.data, result.isFetching, result.isError])
  const pages = result.data?.pages ?? []
  const first = Option.getOrUndefined(Array.head(pages))
  const nodes = Array.dedupeWith<JourneyNode>(
    Array.flatMap(pages, (page) => page.nodes),
    (a, b) => a.id === b.id,
  )
  const candidates = Array.dedupeWith<JourneyRunReference>(
    Array.flatMap(pages, (page) => page.candidates),
    (a, b) => a.id === b.id,
  )
  const edges = Array.flatMap(pages, (page) => page.edges)
  return (
    <div className="grid min-w-0 gap-4" aria-busy={result.isFetching}>
      <DataState
        pending={result.isPending}
        error={result.error}
        retry={() => void result.refetch()}
      />
      {result.isError ? (
        <p className="text-xs text-muted-foreground">
          Evidence could not be read. This does not establish that business
          activity is missing or failed. Retry, or edit the reference selection
          to restart.
        </p>
      ) : null}
      {!result.isError && first ? (
        <>
          <Button
            variant="ghost"
            size="sm"
            className="justify-self-start"
            disabled={result.isFetching}
            onClick={() => void result.refetch()}
          >
            Refresh journey evidence
          </Button>
          {first.state === "NotFound" ? (
            <Alert>
              <AlertTitle>No matching starting run recorded</AlertTitle>
              <AlertDescription>
                Check the reference and declared lookup field. An absent run
                does not prove the business activity did not happen.
              </AlertDescription>
            </Alert>
          ) : null}
          {first.state === "Ambiguous" ? (
            <>
              <Alert>
                <AlertTitle>Choose a starting execution</AlertTitle>
                <AlertDescription>
                  Several executions report this reference. Their identities
                  have not been merged. Select the run whose linked journey you
                  want to inspect.
                </AlertDescription>
              </Alert>
              <ul
                aria-label="Starting execution candidates"
                className="grid gap-2"
              >
                {candidates.map((candidate) => (
                  <li
                    key={candidate.id}
                    className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3"
                  >
                    <div className="min-w-0 text-xs">
                      <p className="break-all font-mono">
                        {candidate.workflow} · {candidate.externalId}
                      </p>
                      <p className="mt-1 text-muted-foreground">
                        {formatTimestamp(candidate.startedAt)} UTC
                      </p>
                    </div>
                    <Button
                      id={`journey-evidence-${candidate.id}`}
                      variant="outline"
                      onClick={() =>
                        onSelect({
                          ...selection,
                          query: {
                            ...selection.query,
                            anchorRunId: candidate.id,
                            candidateCursor: undefined,
                            cursor: undefined,
                          },
                        })
                      }
                      aria-label={`Follow execution ${candidate.externalId}`}
                    >
                      Follow this execution
                    </Button>
                  </li>
                ))}
              </ul>
              {candidates.length >= 100 ? (
                <p className="text-xs text-muted-foreground">
                  Showing up to 100 candidate records from the latest loaded
                  pages.
                </p>
              ) : null}
            </>
          ) : null}
          {first.state === "Selected" ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-medium">Linked executions</h3>
                <Badge variant="outline">{nodes.length} loaded</Badge>
              </div>
              <p className="text-xs leading-6 text-muted-foreground">
                Each execution keeps its own terminal result. Open Confirmations
                for later observed resolutions; they do not rewrite that result.
                “No final outcome” does not establish that a run is active.
              </p>
              {Array.some(pages, (page) => page.bounds.traversalTruncated) ? (
                <Alert>
                  <AlertTitle>Journey boundary reached</AlertTitle>
                  <AlertDescription>
                    Only recorded links within four hops and 100 executions are
                    included. More evidence may exist beyond this boundary.
                  </AlertDescription>
                </Alert>
              ) : null}
              {Array.some(pages, (page) => page.bounds.cycleDetected) ? (
                <p role="status" className="text-xs text-muted-foreground">
                  Recorded links contain a cycle. Each execution is shown once.
                </p>
              ) : null}
              <ul aria-label="Journey executions" className="grid gap-3">
                {nodes.map((node) => (
                  <JourneyRunCard
                    key={node.id}
                    node={node}
                    from={from}
                    edges={edges}
                  />
                ))}
              </ul>
            </>
          ) : null}
          {result.hasNextPage ? (
            <Button
              variant="outline"
              className="justify-self-start"
              disabled={result.isFetching}
              onClick={() => {
                focusNextPage.current = true
                void result.fetchNextPage()
              }}
            >
              {result.isFetchingNextPage
                ? "Loading evidence…"
                : first.state === "Ambiguous"
                  ? "More starting executions"
                  : "More linked executions"}
            </Button>
          ) : null}
          {result.isFetching && !result.isFetchingNextPage ? (
            <p role="status" className="text-xs text-muted-foreground">
              Refreshing recorded evidence…
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
