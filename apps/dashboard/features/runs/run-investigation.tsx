"use client"

import type { AppRouter } from "@flowmark/server/trpc"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  RunSnapshot,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@flowmark/ui"
import type { inferRouterOutputs } from "@trpc/server"
import { Option } from "effect"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useState } from "react"
import { CopyButton, ViewLink } from "../shared/dashboard-components"
import { JsonData } from "../shared/json-data"
import type { RunEvent } from "../platform/api-types"
import { formatTimestamp } from "../shared/format"
import {
  buildRunExport,
  buildTimelineExport,
  stringifyExport,
} from "./run-export"
import { formatReportedProgress } from "./run-presentation"
import { BusinessResult } from "../results/business-result"
import { buildInvestigation } from "./investigation-model"
import { RelatedRunsTable } from "./related-runs-table"
import { RunAttempts } from "./run-attempts"
import { RunComparisonPanel } from "./run-comparison-panel"
import { EventTable } from "./run-event-table"
import { RunEventTimeline } from "./run-event-timeline"
import { OperationWaterfall, ProgressStrip } from "./run-waterfall"

type RunRelationships = inferRouterOutputs<AppRouter>["run"]["related"]
type RunComparison = inferRouterOutputs<AppRouter>["run"]["compare"]

export function RunInvestigation({
  events,
  relationships,
  relationshipsLoading = false,
  relationshipsError,
  comparison,
  comparisonLoading = false,
  comparisonError,
}: {
  events: readonly RunEvent[]
  relationships?: RunRelationships
  relationshipsLoading?: boolean
  relationshipsError?: string
  comparison?: RunComparison
  comparisonLoading?: boolean
  comparisonError?: string
}) {
  const routeParams = useSearchParams()
  const linkedEventId = events.find(
    (event) => event.id === routeParams.get("event"),
  )?.id
  const [evidenceSelection, setEvidenceSelection] = useState<
    { id: string; revision: number } | undefined
  >(linkedEventId ? { id: linkedEventId, revision: 0 } : undefined)
  const [timelineView, setTimelineView] = useState<
    "timeline" | "waterfall" | "events"
  >(linkedEventId ? "events" : "timeline")
  const model = buildInvestigation(events)
  if (Option.isNone(model)) {
    return null
  }
  const {
    first,
    context,
    failure,
    completed,
    state,
    progress,
    reportedResult,
    lastReport,
    snapshot,
    errors,
    operations,
  } = model.value
  return (
    <div className="grid min-w-0 gap-6">
      {snapshot && (
        <RunSnapshot
          {...snapshot}
          actions={
            <>
              <ViewLink
                href={`/workflows/${encodeURIComponent(first.workflow)}`}
              >
                View workflow
              </ViewLink>
              {(() => {
                const runExport = buildRunExport(events)
                const timelineExport = buildTimelineExport(events)
                return (
                  <>
                    {runExport && (
                      <CopyButton
                        label="Copy run JSON"
                        value={stringifyExport(runExport)}
                      />
                    )}
                    {timelineExport && (
                      <CopyButton
                        label="Copy timeline JSON"
                        value={stringifyExport(timelineExport)}
                      />
                    )}
                  </>
                )
              })()}
            </>
          }
        />
      )}
      <Tabs
        defaultValue={
          linkedEventId
            ? "timeline"
            : routeParams.get("view") === "compare"
              ? "compare"
              : "outcome"
        }
        className="min-w-0"
      >
        <TabsList
          variant="line"
          aria-label="Run investigation sections"
          className="h-auto w-full flex-wrap justify-start gap-1 border-b border-border pb-2 [&_[data-slot=tabs-trigger]]:min-h-11 [&_[data-slot=tabs-trigger]]:flex-none"
        >
          <TabsTrigger value="outcome">Outcome</TabsTrigger>
          <TabsTrigger value="timeline">Timeline ({events.length})</TabsTrigger>
          <TabsTrigger value="context">Context</TabsTrigger>
          <TabsTrigger value="compare">Compare</TabsTrigger>
          <TabsTrigger value="related">Related runs</TabsTrigger>
        </TabsList>
        <TabsContent value="outcome" className="mt-4 grid min-w-0 gap-5">
          {failure && (
            <Alert variant="destructive">
              <AlertTitle>{failure.error?.code ?? "Run failed"}</AlertTitle>
              <AlertDescription>
                {failure.error?.message ??
                  failure.reason ??
                  "No failure message recorded."}
                {failure.error?.retryable !== undefined && (
                  <p>
                    Reported retryable: {failure.error.retryable ? "yes" : "no"}
                    . Flowmark does not retry this work.
                  </p>
                )}
              </AlertDescription>
            </Alert>
          )}
          {state === "Running" && (
            <Alert>
              <AlertTitle>No final outcome recorded</AlertTitle>
              <AlertDescription>
                The run may still be active, or telemetry may have stopped.
                Check application logs before retrying.
              </AlertDescription>
            </Alert>
          )}
          {lastReport && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Last reported business work
                </CardTitle>
                <CardDescription>
                  Latest received non-final whole snapshot. Missing fields are
                  unknown. This observation does not prove the run is active or
                  failed.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <dl className="grid gap-3 text-xs sm:grid-cols-2">
                  <div>
                    <dt>Reported (UTC)</dt>
                    <dd>{formatTimestamp(lastReport.timestamp)}</dd>
                  </div>
                  <div>
                    <dt>Received (UTC)</dt>
                    <dd>{formatTimestamp(lastReport.receivedAt)}</dd>
                  </div>
                </dl>
                <BusinessResult
                  workflow={first.workflow}
                  result={lastReport.result}
                  properties={
                    events.find((event) => event.type === "started")?.properties
                  }
                  nonFinal
                />
                <Accordion>
                  <AccordionItem value="raw-report">
                    <AccordionTrigger>Raw snapshot data</AccordionTrigger>
                    <AccordionContent>
                      <JsonData value={lastReport.result} />
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Final reported result</CardTitle>
              <CardDescription>
                Reported by application code, not independently verified.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <BusinessResult
                workflow={first.workflow}
                outcome={(failure ?? completed)?.outcome}
                result={reportedResult}
                properties={
                  events.find((event) => event.type === "started")?.properties
                }
              />
              {reportedResult == null && (
                <p className="text-xs leading-6 text-muted-foreground">
                  No business result was attached to this run.
                </p>
              )}
              {reportedResult != null && (
                <Accordion>
                  <AccordionItem value="raw-result">
                    <AccordionTrigger>Raw result data</AccordionTrigger>
                    <AccordionContent>
                      <JsonData value={reportedResult} />
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recorded evidence</CardTitle>
            </CardHeader>
            <CardContent>
              {progress && (
                <p className="mb-5 text-sm">
                  <strong>Last reported progress:</strong>{" "}
                  {formatReportedProgress(progress)}
                </p>
              )}
              <div className="mb-5">
                <ProgressStrip events={events} />
              </div>
              <div className="mb-4 flex flex-wrap gap-2">
                <Badge variant="secondary">
                  {operations.length} operations
                </Badge>
                <Badge variant="secondary">
                  {
                    events.filter((event) => event.type === "operation_failed")
                      .length
                  }{" "}
                  failed operations
                </Badge>
                <Badge variant="secondary">
                  {errors.length} observed errors
                </Badge>
                <Badge variant="secondary">
                  {
                    errors.filter(
                      (event) =>
                        event.error &&
                        "handled" in event.error &&
                        event.error.handled,
                    ).length
                  }{" "}
                  handled errors
                </Badge>
              </div>
              <p className="py-3 text-xs leading-6 text-muted-foreground">
                A handled error or failed operation does not by itself fail the
                workflow. Inspect the timeline and use recorded identifiers to
                continue in your application logs.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="timeline" className="mt-4 grid min-w-0 gap-5">
          <Card>
            <CardHeader className="flex-row flex-wrap items-start justify-between gap-4 space-y-0">
              <div>
                <CardTitle>
                  {timelineView === "waterfall"
                    ? "Operation waterfall"
                    : timelineView === "events"
                      ? "Event table"
                      : "Event timeline"}
                </CardTitle>
                <CardDescription className="mt-2">
                  {timelineView === "waterfall"
                    ? "Recorded operation intervals, overlap, and idle gaps between endpoints."
                    : timelineView === "events"
                      ? "Filter and expand rows for full payloads and timestamps."
                      : "Checkpoints, operations, progress, and failures in order. Expand rows with payloads."}
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={
                    timelineView === "timeline" ? "secondary" : "outline"
                  }
                  aria-pressed={timelineView === "timeline"}
                  onClick={() => setTimelineView("timeline")}
                >
                  Timeline
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={
                    timelineView === "waterfall" ? "secondary" : "outline"
                  }
                  aria-pressed={timelineView === "waterfall"}
                  onClick={() => setTimelineView("waterfall")}
                >
                  Operations
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={timelineView === "events" ? "secondary" : "outline"}
                  aria-pressed={timelineView === "events"}
                  onClick={() => setTimelineView("events")}
                >
                  Table
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <RunAttempts
                events={events}
                onEvidence={(id) => {
                  setEvidenceSelection((previous) => ({
                    id,
                    revision: (previous?.revision ?? 0) + 1,
                  }))
                  setTimelineView("events")
                  requestAnimationFrame(() =>
                    document
                      .getElementById(`event-${id}`)
                      ?.scrollIntoView({ block: "center" }),
                  )
                }}
              />
              {timelineView === "waterfall" ? (
                <OperationWaterfall events={events} />
              ) : timelineView === "events" ? (
                <EventTable
                  key={evidenceSelection?.revision}
                  events={events}
                  initialEventId={evidenceSelection?.id}
                />
              ) : (
                <RunEventTimeline events={events} />
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="context" className="mt-4 grid min-w-0 gap-5">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Run context</CardTitle>
              <CardDescription>
                Latest shallow merge of initial properties and context
                amendments. Event history stays unchanged.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="mb-5 grid gap-4 text-xs sm:grid-cols-2 [&_dt]:text-muted-foreground [&_dd]:mt-1 [&_dd]:break-all">
                <div>
                  <dt>Started (UTC)</dt>
                  <dd>{formatTimestamp(first.timestamp)}</dd>
                </div>
                <div>
                  <dt>Environment</dt>
                  <dd>{first.environment ?? "Not recorded"}</dd>
                </div>
                <div>
                  <dt>Release</dt>
                  <dd>{first.release ?? "Not recorded"}</dd>
                </div>
                <div>
                  <dt>External run ID</dt>
                  <dd>
                    <code>{first.externalId}</code>
                  </dd>
                </div>
              </dl>
              {context.size > 0 ? (
                <JsonData value={Object.fromEntries(context)} />
              ) : (
                <p className="text-xs text-muted-foreground">
                  No properties recorded.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="compare" className="mt-4 grid min-w-0 gap-5">
          <RunComparisonPanel
            comparison={comparison}
            loading={comparisonLoading}
            error={comparisonError}
          />
        </TabsContent>
        <TabsContent value="related" className="mt-4 grid min-w-0 gap-5">
          <Card>
            <CardHeader>
              <CardTitle>Explicit run links</CardTitle>
              <CardDescription>
                Application-declared associations, not proof of causation or a
                distributed trace. Browser-supplied links are untrusted.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <dl className="mb-5 grid gap-4 text-xs sm:grid-cols-2 [&_dt]:text-muted-foreground [&_dd]:mt-1 [&_dd]:break-all">
                <div>
                  <dt>Correlation ID</dt>
                  <dd className="flex flex-wrap items-center gap-2">
                    {first.correlationId ? (
                      <>
                        <Link
                          className="font-medium hover:text-primary hover:underline"
                          href={`/runs?search=${encodeURIComponent(first.correlationId)}`}
                        >
                          <code>{first.correlationId}</code>
                        </Link>
                        <CopyButton value={first.correlationId} label="Copy" />
                      </>
                    ) : (
                      <code>Not supplied</code>
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Parent run ID</dt>
                  <dd className="flex flex-wrap items-center gap-2">
                    {first.parentRunId ? (
                      <>
                        <Link
                          className="font-medium hover:text-primary hover:underline"
                          href={`/runs?search=${encodeURIComponent(first.parentRunId)}`}
                        >
                          <code>{first.parentRunId}</code>
                        </Link>
                        <CopyButton value={first.parentRunId} label="Copy" />
                      </>
                    ) : (
                      <code>Not supplied</code>
                    )}
                  </dd>
                </div>
              </dl>
              {relationshipsError ? (
                <Alert variant="destructive">
                  <AlertDescription>
                    Could not load linked runs: {relationshipsError}
                  </AlertDescription>
                </Alert>
              ) : relationshipsLoading ? (
                <p role="status">Loading linked runs…</p>
              ) : (
                <>
                  {first.retryOf && (
                    <p className="my-3 text-sm">
                      Retry of{" "}
                      <code>
                        {first.retryOf.workflow} / {first.retryOf.runId}
                      </code>
                      . This execution has its own status and reported result;
                      totals across executions are not deduplicated items.
                    </p>
                  )}
                  <RelatedRunsTable
                    title="Previous execution (explicit retry link)"
                    runs={relationships?.retryMatches ?? []}
                    empty={
                      first.retryOf
                        ? "Referenced execution not recorded or not accessible in this project."
                        : "No retry-of reference supplied."
                    }
                  />
                  <RelatedRunsTable
                    title="Later executions retrying this run"
                    runs={relationships?.retries ?? []}
                    empty="No later retry links recorded in this project."
                  />
                  <RelatedRunsTable
                    title="Parent matches"
                    runs={relationships?.parentMatches ?? []}
                    empty={
                      first.parentRunId
                        ? "No matching parent recorded in this project."
                        : "No parent link supplied."
                    }
                  />
                  <RelatedRunsTable
                    title="Shared correlation"
                    runs={relationships?.related ?? []}
                    empty={
                      first.correlationId
                        ? "No other matching runs recorded."
                        : "No correlation ID supplied."
                    }
                  />
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
