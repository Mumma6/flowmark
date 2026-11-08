"use client"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@flowmark/ui"
import { Option, Result } from "effect"
import { studioRunSelection } from "./investigation-selection"
import { useMemo, useSyncExternalStore } from "react"
import { useSearchParams } from "next/navigation"
import type { RunEvent } from "../platform/api-types"
import { useProject } from "../projects/project-context"
import { CopyButton, ViewLink } from "../shared/dashboard-components"
import { readExplorerFilters } from "./explorer-filters"
import {
  buildRunExport,
  buildTimelineExport,
  stringifyExport,
} from "./run-export"
import { investigationHandoff } from "./investigation-handoff"
import {
  investigationReturn,
  runInvestigationPath,
} from "./investigation-navigation"
import { InvestigationContextHandoffCard } from "./investigation-context-handoff-card"
import { buildSafeRunContextHandoff } from "./safe-run-context-handoff"

const subscribe = () => () => undefined

export function RunHandoff({
  runId,
  events,
  contextual = false,
}: {
  runId: string
  events: readonly RunEvent[]
  contextual?: boolean
}) {
  const params = useSearchParams()
  const { current } = useProject()
  const source = params.has("from")
    ? investigationReturn(params.get("from")).href
    : undefined
  const origin = useSyncExternalStore(
    subscribe,
    () => window.location.origin,
    () => "",
  )
  const runPath = `${origin}/runs/${runId}`
  const filterQuery = params.toString()
  const sourceFrom = params.get("from")
  const filters = useMemo(
    () => readExplorerFilters(params),
    [filterQuery, params],
  )
  const runSelection = current
    ? studioRunSelection(current.id, runId)
    : undefined
  const studioReturn =
    runSelection && origin
      ? Result.map(
          runSelection,
          (selection) =>
            `${origin}${runInvestigationPath(runId, source, undefined, undefined, selection)}`,
        )
      : undefined
  const returnUrl = studioReturn
    ? Result.match(studioReturn, {
        onFailure: () => null,
        onSuccess: (href) => href,
      })
    : null
  const safeContext = useMemo(() => {
    if (!current?.id) {
      return Option.none()
    }
    return buildSafeRunContextHandoff(
      events,
      {
        projectId: current.id,
        projectName: current.name,
        runPath,
        sourceFrom,
        filters,
        returnUrl,
      },
      origin,
    )
  }, [
    current?.id,
    current?.name,
    events,
    filters,
    origin,
    returnUrl,
    runPath,
    sourceFrom,
  ])
  const summary = investigationHandoff(events, runPath)
  if (Option.isNone(summary)) {
    return null
  }
  return (
    <div className="grid gap-6">
      {Option.isSome(safeContext) ? (
        <InvestigationContextHandoffCard handoff={safeContext.value} />
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>Take the evidence with you</CardTitle>
          <CardDescription>
            Use these identifiers to continue in your application logs or attach
            the summary to an issue. The summary contains recorded facts; add
            your conclusion and next action yourself.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5">
          <div className="flex flex-wrap gap-3">
            <CopyButton
              label="Copy investigation summary"
              variant="outline"
              value={summary.value}
            />
            <CopyButton
              label="Copy run JSON"
              value={stringifyExport(buildRunExport(events))}
            />
            <CopyButton
              label="Copy timeline JSON"
              value={stringifyExport(buildTimelineExport(events))}
            />
          </div>
          {runSelection
            ? Result.match(runSelection, {
                onFailure: () => (
                  <p role="alert" className="text-sm text-destructive">
                    This run cannot be represented by the supported selection
                    format.
                  </p>
                ),
                onSuccess: (selection) => (
                  <details className="rounded-lg border border-border p-4">
                    <summary className="cursor-pointer text-sm font-medium">
                      Structured run selection
                    </summary>
                    <p className="my-3 text-xs leading-6 text-muted-foreground">
                      Version 1 identifies this run and its first event page. It
                      contains no credentials and grants no access. Each read
                      observes the current evidence.
                    </p>
                    <pre className="mb-3 overflow-x-auto whitespace-pre-wrap break-all text-xs">
                      {JSON.stringify(selection, null, 2)}
                    </pre>
                    <CopyButton
                      label="Copy run selection"
                      value={JSON.stringify(selection)}
                    />
                    {returnUrl ? (
                      <CopyButton label="Copy Studio link" value={returnUrl} />
                    ) : null}
                  </details>
                ),
              })
            : null}
          <p className="text-sm leading-6 text-muted-foreground">
            Full JSON exports include raw payloads. Prefer{" "}
            <strong className="font-medium text-foreground">
              Copy investigation context
            </strong>{" "}
            above when pasting into an agent unless you explicitly need complete
            event bodies.
          </p>
          <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-lg border border-border bg-muted/30 p-4 text-sm leading-7">
            {summary.value}
          </pre>
          <p className="text-base leading-7 text-muted-foreground">
            Before you finish: identify the execution and time, record the
            observed failure or missing evidence, and decide who needs to
            investigate in the owning application.
          </p>
          <div className="flex flex-wrap gap-2">
            <ViewLink
              href={runInvestigationPath(runId, source, "timeline")}
              replace={contextual}
            >
              Review timeline
            </ViewLink>
            <ViewLink
              href={runInvestigationPath(runId, source, "context")}
              replace={contextual}
            >
              Find application identifiers
            </ViewLink>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
