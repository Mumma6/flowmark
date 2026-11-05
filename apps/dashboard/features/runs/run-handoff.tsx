"use client"

import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@flowmark/ui"
import { Option } from "effect"
import { Check } from "lucide-react"
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
import { buildSafeRunContextHandoff } from "./safe-run-context-handoff"
import { useRunHandoffCopyState } from "./use-run-handoff-copy-state"

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
  const { contextCopied, markContextCopied } = useRunHandoffCopyState()
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
      },
      origin,
    )
  }, [current?.id, current?.name, events, filters, origin, runPath, sourceFrom])
  const summary = investigationHandoff(events, runPath)
  if (Option.isNone(summary)) {
    return null
  }
  return (
    <div className="grid gap-6">
      {Option.isSome(safeContext) ? (
        <Card>
          <CardHeader>
            <CardTitle>Preview investigation context</CardTitle>
            <CardDescription>
              Factual summary for your agent with deliberate redaction. Copy
              only when you intend to paste it elsewhere. Remote MCP tools are
              not available — use this text and the evidence link, not
              unimplemented tool calls.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5">
            <div className="flex flex-wrap items-center gap-3">
              <CopyButton
                label="Copy investigation context"
                variant="default"
                value={safeContext.value.preview}
                onCopied={markContextCopied}
              />
              {contextCopied ? (
                <Badge variant="success">
                  <span className="inline-flex items-center gap-1">
                    <Check aria-hidden="true" className="size-3" />
                    Copied locally
                  </span>
                </Badge>
              ) : null}
            </div>
            <ul className="grid gap-1 text-sm leading-6 text-muted-foreground">
              {safeContext.value.omissions.map((item) => (
                <li key={item}>Omitted: {item}</li>
              ))}
            </ul>
            <pre className="max-h-96 overflow-x-auto whitespace-pre-wrap break-words rounded-lg border border-border bg-muted/30 p-4 text-sm leading-7">
              {safeContext.value.preview}
            </pre>
          </CardContent>
        </Card>
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
