"use client"

import { useState } from "react"
import Link from "next/link"
import type { inferRouterOutputs } from "@trpc/server"
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@flowmark/ui"
import {
  formatReportedProgress,
  getRunDurationMs,
  getRunResultHighlights,
  latestReportedProgress,
} from "./run-presentation"
import {
  CopyButton,
  StatusBadge,
  TablePagination,
  ViewLink,
} from "./dashboard-components"
import { formatDuration, formatTimestamp, paginate } from "./dashboard-data"
import { RunCompareChart } from "./insight-charts"
import {
  buildRunExport,
  buildTimelineExport,
  stringifyExport,
} from "./run-export"
import { EventTable, JsonData, type RunEvent } from "./run-event-table"
import { OperationWaterfall, ProgressStrip } from "./run-waterfall"

type RunRelationships = inferRouterOutputs<AppRouter>["run"]["related"]
type RunComparison = inferRouterOutputs<AppRouter>["run"]["compare"]
type RelatedRun = RunRelationships["related"][number]

function RelatedRunsTable({
  title,
  runs,
  empty,
}: {
  title: string
  runs: readonly RelatedRun[]
  empty: string
}) {
  const [page, setPage] = useState(1)
  const result = paginate(runs, page, 10)
  return (
    <section>
      <h3 className="mb-3 mt-4 text-sm font-semibold">{title}</h3>
      {runs.length > 0 ? (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Workflow</TableHead>
                <TableHead>Run</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Started (UTC)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.items.map((run) => (
                <TableRow key={run.id}>
                  <TableCell>
                    <Link
                      className="font-medium hover:text-primary hover:underline"
                      href={`/workflows/${encodeURIComponent(run.workflow)}`}
                    >
                      {run.workflow}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link
                      className="font-medium hover:text-primary hover:underline"
                      href={`/runs/${run.id}`}
                    >
                      <code>{run.externalId}</code>
                    </Link>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={run.status} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {formatTimestamp(run.startedAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <TablePagination {...result} onPageChange={setPage} />
        </>
      ) : (
        <p className="py-3 text-xs leading-6 text-muted-foreground">{empty}</p>
      )}
    </section>
  )
}

function durationDelta(current: number | null, peer: number | null) {
  if (current == null || peer == null) {
    return null
  }
  return current - peer
}

function RunComparisonPanel({
  comparison,
  loading,
  error,
}: {
  comparison?: RunComparison
  loading: boolean
  error?: string
}) {
  const current = comparison?.current
  const peerCount = comparison?.peers.length ?? 0
  const vsMedian = durationDelta(
    current?.durationMs ?? null,
    comparison?.peerMedianDurationMs ?? null,
  )
  const vsP95 = durationDelta(
    current?.durationMs ?? null,
    comparison?.peerP95DurationMs ?? null,
  )
  return (
    <Card>
      <CardHeader>
        <CardTitle>Compared with up to 50 earlier runs</CardTitle>
        <CardDescription>
          Same workflow. Duration, reported outcome, and named operations
          against recent peers. Comparison does not state a cause.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>
              Could not load comparison: {error}
            </AlertDescription>
          </Alert>
        ) : loading ? (
          <p role="status">Loading comparison…</p>
        ) : !current || peerCount === 0 ? (
          <p className="text-sm text-muted-foreground">
            No earlier runs of this workflow to compare yet.
          </p>
        ) : (
          <>
            {peerCount < 5 && (
              <Alert>
                <AlertTitle>Few peers</AlertTitle>
                <AlertDescription>
                  Only {peerCount} earlier run{peerCount === 1 ? "" : "s"}.
                  Treat median and p95 as thin samples, not a regression signal.
                </AlertDescription>
              </Alert>
            )}
            <RunCompareChart
              currentMs={current.durationMs}
              peerMedianMs={comparison.peerMedianDurationMs}
              peerP95Ms={comparison.peerP95DurationMs}
            />
            <dl className="grid gap-4 text-sm sm:grid-cols-3 [&_dt]:text-xs [&_dt]:text-muted-foreground [&_dd]:mt-1 [&_dd]:font-medium">
              <div>
                <dt>This run</dt>
                <dd>{formatDuration(current.durationMs)}</dd>
              </div>
              <div>
                <dt>Peer median</dt>
                <dd>
                  {formatDuration(comparison.peerMedianDurationMs)}
                  {vsMedian != null && (
                    <p className="mt-1 text-xs font-normal text-muted-foreground">
                      {vsMedian === 0
                        ? "Same as median"
                        : vsMedian > 0
                          ? `${formatDuration(vsMedian)} slower`
                          : `${formatDuration(Math.abs(vsMedian))} faster`}
                    </p>
                  )}
                </dd>
              </div>
              <div>
                <dt>Peer p95</dt>
                <dd>
                  {formatDuration(comparison.peerP95DurationMs)}
                  {vsP95 != null && (
                    <p className="mt-1 text-xs font-normal text-muted-foreground">
                      {vsP95 > 0 ? "Slower than p95" : "Within the usual range"}
                    </p>
                  )}
                </dd>
              </div>
            </dl>
            <p className="text-xs text-muted-foreground">
              Peer success rate among finished peers:{" "}
              {comparison.peerSuccessRate == null
                ? "No finished peers"
                : `${comparison.peerSuccessRate}%`}
              . {peerCount} earlier runs in this comparison window.
            </p>
            {(comparison.operations?.length ?? 0) > 0 && (
              <section className="grid gap-3">
                <h3 className="text-sm font-semibold">Operations vs peers</h3>
                <p className="text-xs leading-6 text-muted-foreground">
                  Presence and duration differences in recorded operations.
                  Absent means this run did not record that operation name.
                </p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Operation</TableHead>
                      <TableHead>This run</TableHead>
                      <TableHead>Peer median</TableHead>
                      <TableHead>In peers</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {comparison.operations.map((row) => (
                      <TableRow key={row.name}>
                        <TableCell>
                          <span className="font-medium">{row.name}</span>
                          <p className="text-xs text-muted-foreground">
                            {row.currentStatus}
                          </p>
                        </TableCell>
                        <TableCell>
                          {formatDuration(row.currentDurationMs)}
                        </TableCell>
                        <TableCell>
                          {formatDuration(row.peerMedianDurationMs)}
                        </TableCell>
                        <TableCell>
                          <div className="grid gap-1">
                            <span>
                              {row.peerPresentCount}/{peerCount}
                            </span>
                            {row.peerRunIds.length > 0 && (
                              <span className="flex flex-wrap gap-1 text-xs">
                                {row.peerRunIds.slice(0, 3).map((runId) => (
                                  <Link
                                    key={runId}
                                    className="font-mono text-muted-foreground hover:text-primary hover:underline"
                                    href={`/runs/${runId}`}
                                  >
                                    {runId.slice(0, 8)}
                                  </Link>
                                ))}
                              </span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </section>
            )}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Run</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Started (UTC)</TableHead>
                  <TableHead>Business result</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Delta vs this run</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {comparison.peers.map((peer) => {
                  const delta = durationDelta(
                    current.durationMs,
                    peer.durationMs,
                  )
                  const highlights = getRunResultHighlights(peer.result ?? {})
                  return (
                    <TableRow key={peer.id}>
                      <TableCell>
                        <Link
                          className="font-medium hover:text-primary hover:underline"
                          href={`/runs/${peer.id}`}
                        >
                          <code>{peer.externalId}</code>
                        </Link>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={peer.status} />
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {formatTimestamp(peer.startedAt)}
                      </TableCell>
                      <TableCell>
                        {highlights.length > 0
                          ? highlights
                              .map((item) => `${item.label}: ${item.value}`)
                              .join(" · ")
                          : "—"}
                      </TableCell>
                      <TableCell>{formatDuration(peer.durationMs)}</TableCell>
                      <TableCell>
                        {delta == null
                          ? "—"
                          : delta === 0
                            ? "Same"
                            : delta > 0
                              ? `${formatDuration(delta)} faster than this run`
                              : `${formatDuration(Math.abs(delta))} slower than this run`}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </>
        )}
      </CardContent>
    </Card>
  )
}

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
  const [timelineView, setTimelineView] = useState<"waterfall" | "events">(
    "waterfall",
  )
  const first = events[0]
  if (!first) {
    return null
  }
  const context = new Map<string, unknown>()
  for (const event of events) {
    if (event.type === "started" || event.type === "properties") {
      for (const [key, value] of Object.entries(event.properties ?? {})) {
        context.set(key, value)
      }
    }
  }
  const failure = events.find((event) => event.type === "failed")
  const completed = [...events]
    .reverse()
    .find((event) => event.type === "completed")
  const state = failure ? "Failed" : completed ? "Completed" : "Running"
  const progress = latestReportedProgress(events)
  const reportedResult = failure?.result ?? completed?.result
  const highlights = getRunResultHighlights(reportedResult ?? {})
  const errors = events.filter((event) => event.type === "error")
  const operations = events.filter(
    (event) => event.type === "operation_started",
  )
  return (
    <div className="grid min-w-0 gap-6">
      <Card className="overflow-hidden border-primary/20">
        <CardHeader className="flex-row flex-wrap items-start justify-between gap-4 space-y-0">
          <div>
            <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.14em] text-primary/80">
              One execution · reported outcome
            </p>
            <CardTitle>{first.workflow}</CardTitle>
            <CardDescription>
              <code className="break-all">{first.externalId}</code>
            </CardDescription>
          </div>
          <StatusBadge status={state} />
        </CardHeader>
        <CardContent>
          <div className="mb-4 grid grid-cols-2 gap-2 sm:flex">
            {first.environment && (
              <Badge variant="outline">{first.environment}</Badge>
            )}
            {first.release && (
              <Badge variant="outline">Release {first.release}</Badge>
            )}
            <Badge
              variant="outline"
              title="Elapsed from started to done() or fail(), when recorded"
            >
              {formatDuration(getRunDurationMs(events))}
            </Badge>
            <Badge
              variant="outline"
              title="Persisted telemetry events for this run"
            >
              {events.length} events
            </Badge>
          </div>
          <p className="mb-4 text-xs leading-6 text-muted-foreground">
            Duration is elapsed time to a recorded terminal outcome. Events are
            what the application sent. Running means no final outcome yet — not
            proof the process is still active.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <ViewLink href={`/workflows/${encodeURIComponent(first.workflow)}`}>
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
          </div>
        </CardContent>
      </Card>
      <Tabs defaultValue="outcome" className="min-w-0">
        <TabsList
          aria-label="Run investigation sections"
          className="h-auto w-full flex-wrap justify-start gap-1"
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
          <Card>
            <CardHeader>
              <CardTitle>Business result</CardTitle>
              <CardDescription>
                Reported by application code, not independently verified.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {highlights.length > 0 ? (
                <dl className="mb-5 flex flex-wrap gap-5 [&>div]:min-w-[100px] [&>div]:rounded-lg [&>div]:border [&>div]:border-border [&>div]:p-4 [&_dt]:text-xs [&_dt]:text-muted-foreground [&_dd]:mt-2 [&_dd]:break-all [&_dd]:text-2xl [&_dd]:font-semibold">
                  {highlights.map((item) => (
                    <div key={item.key}>
                      <dt>{item.label}</dt>
                      <dd>{item.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="text-xs leading-6 text-muted-foreground">
                  {reportedResult != null
                    ? "Result recorded. Expand raw result data to inspect it."
                    : failure
                      ? "No business result was attached to the failure."
                      : completed
                        ? "No business result was attached to completion."
                        : "No business result recorded."}
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
              <CardTitle>Recorded evidence</CardTitle>
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
                    : "Event timeline"}
                </CardTitle>
                <CardDescription className="mt-2">
                  {timelineView === "waterfall"
                    ? "Recorded operation intervals, overlap, and idle gaps between endpoints."
                    : "Checkpoints, operations, progress and failures. Filter before expanding payloads."}
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={
                    timelineView === "waterfall" ? "secondary" : "outline"
                  }
                  onClick={() => setTimelineView("waterfall")}
                >
                  Waterfall
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={timelineView === "events" ? "secondary" : "outline"}
                  onClick={() => setTimelineView("events")}
                >
                  Events
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {timelineView === "waterfall" ? (
                <OperationWaterfall events={events} />
              ) : (
                <EventTable events={events} />
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="context" className="mt-4 grid min-w-0 gap-5">
          <Card>
            <CardHeader>
              <CardTitle>Run context</CardTitle>
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
