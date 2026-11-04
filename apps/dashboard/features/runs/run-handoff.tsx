"use client"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@flowmark/ui"
import { Option } from "effect"
import { useSyncExternalStore } from "react"
import { useSearchParams } from "next/navigation"
import type { RunEvent } from "../platform/api-types"
import { CopyButton, ViewLink } from "../shared/dashboard-components"
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

const subscribe = () => () => undefined

export function RunHandoff({
  runId,
  events,
}: {
  runId: string
  events: readonly RunEvent[]
}) {
  const params = useSearchParams()
  const source = params.has("from")
    ? investigationReturn(params.get("from")).href
    : undefined
  const origin = useSyncExternalStore(
    subscribe,
    () => window.location.origin,
    () => "",
  )
  const summary = investigationHandoff(events, `${origin}/runs/${runId}`)
  if (Option.isNone(summary)) {
    return null
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Take the evidence with you</CardTitle>
        <CardDescription>
          Use these identifiers to continue in your application logs or attach
          the summary to an issue. The summary contains recorded facts; add your
          conclusion and next action yourself.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5">
        <div className="flex flex-wrap gap-3">
          <CopyButton
            label="Copy investigation summary"
            variant="default"
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
        <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-lg border border-border bg-muted/30 p-4 text-sm leading-7">
          {summary.value}
        </pre>
        <p className="text-base leading-7 text-muted-foreground">
          Before you finish: identify the execution and time, record the
          observed failure or missing evidence, and decide who needs to
          investigate in the owning application.
        </p>
        <div className="flex flex-wrap gap-2">
          <ViewLink href={runInvestigationPath(runId, source, "timeline")}>
            Review timeline
          </ViewLink>
          <ViewLink href={runInvestigationPath(runId, source, "context")}>
            Find application identifiers
          </ViewLink>
        </div>
      </CardContent>
    </Card>
  )
}
