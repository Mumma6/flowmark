"use client"

import { BusinessResult } from "./business-result"
import { useSearchParams, usePathname } from "next/navigation"
import { useState } from "react"
import Link from "next/link"
import type { inferRouterOutputs } from "@trpc/server"
import type { AppRouter } from "@flowmark/server/trpc"
import {
  Input,
  NativeSelect,
  RunSnapshot,
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
import { RunEventTimeline } from "./run-event-timeline"
import { OperationWaterfall, ProgressStrip } from "./run-waterfall"
import { buildRunSnapshot } from "./run-snapshot-presentation"

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
  const params = useSearchParams()
  const pathname = usePathname()
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
          Same workflow, strictly earlier by start timestamp and ID. Default:
          previous 30 days and matching environment, including
          missing-to-missing. No silent fallback. Comparison does not state a
          cause.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <form action={pathname} className="grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="view" value="compare" />
          <label className="text-sm">
            Previous days
            <Input
              name="peerDays"
              type="number"
              min={1}
              max={90}
              defaultValue={params.get("peerDays") ?? "30"}
            />
          </label>
          <label className="text-sm">
            Peer environment
            <NativeSelect
              name="peerEnvironment"
              defaultValue={params.get("peerEnvironment") ?? "same"}
            >
              <option value="same">Same environment</option>
              <option value="all">
                All environments (explicit broadening)
              </option>
            </NativeSelect>
          </label>
          <label className="text-sm">
            Peer release
            <NativeSelect
              name="peerRelease"
              defaultValue={params.get("peerRelease") ?? "all"}
            >
              <option value="all">All releases</option>
              <option value="same">
                Same release (missing matches missing)
              </option>
            </NativeSelect>
          </label>
          <label className="text-sm">
            Declared dimension key
            <Input
              name="peerDimension"
              maxLength={128}
              defaultValue={params.get("peerDimension") ?? ""}
            />
          </label>
          <label className="text-sm">
            Declared dimension value
            <Input
              name="peerValue"
              maxLength={2048}
              defaultValue={params.get("peerValue") ?? ""}
            />
          </label>
          <Button type="submit">Apply peer selection</Button>
        </form>
        {comparison?.population && (
          <p className="text-sm">
            Eligible {comparison.population.eligible}; selected{" "}
            {comparison.population.selected} (cap 50), minimum descriptive
            sample {comparison.population.minimumSample}. Window:{" "}
            {comparison.population.days} days before this run, UTC; environment:{" "}
            {comparison.population.allEnvironments
              ? "all (explicit)"
              : (comparison.population.environment ?? "missing only")}
            ; release:{" "}
            {comparison.population.sameRelease
              ? (comparison.population.release ?? "missing only")
              : "all"}
            . Workload normalization unavailable: no validated stable
            input-volume definition. Recorded results are context, not inferred
            workload.
          </p>
        )}
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
            {(peerCount < 5 ||
              (comparison.population?.durationObservations ?? 0) < 5) && (
              <Alert>
                <AlertTitle>Few peers</AlertTitle>
                <AlertDescription>
                  Selected {peerCount} earlier runs;{" "}
                  {comparison.population?.durationObservations ?? 0} have
                  terminal durations. Treat median and p95 as thin samples, not
                  a regression signal.
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
                      {vsP95 > 0 ? "Above peer p95" : "At or below peer p95"}
                    </p>
                  )}
                </dd>
              </div>
            </dl>
            <p className="text-xs text-muted-foreground">
              Peer run completion among finished peers:{" "}
              {comparison.peerSuccessRate == null
                ? "No finished peers"
                : `${comparison.peerSuccessRate}%`}
              . {peerCount} earlier runs in this comparison window.
            </p>
            {(comparison.operations?.length ?? 0) > 0 && (
              <section className="grid gap-3">
                <h3 className="text-sm font-semibold">Operations vs peers</h3>
                <p className="text-xs leading-6 text-muted-foreground">
                  Presence and duration differences in recorded operations (up
                  to 100 names, alphabetical). Absent means this run did not
                  record that operation name. Repeated names are occurrences,
                  not inferred retries. Total recorded work can exceed wall time
                  when operations overlap. The legacy peer median uses the
                  longest occurrence per peer for compatibility; it is not the
                  per-occurrence median.
                </p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Operation</TableHead>
                      <TableHead>This run</TableHead>
                      <TableHead>Peer operation statistics</TableHead>
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
                          <p>
                            {row.currentOccurrenceCount ?? 0} occurrences;{" "}
                            {row.currentOpenCount ?? 0} open;{" "}
                            {row.currentFailedCount ?? 0} failed
                          </p>
                          <p>
                            Per-occurrence median{" "}
                            {formatDuration(
                              row.currentMedianOccurrenceDurationMs ?? null,
                            )}
                          </p>
                          <p>
                            Total recorded work{" "}
                            {formatDuration(
                              row.currentTotalRecordedDurationMs ?? null,
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Longest (legacy):{" "}
                            {formatDuration(row.currentDurationMs)}
                          </p>
                        </TableCell>
                        <TableCell>
                          <p>
                            Median of per-run occurrence medians:{" "}
                            {formatDuration(
                              row.peerMedianOccurrenceDurationMs ?? null,
                            )}
                          </p>
                          <p>
                            Median recorded work per present peer:{" "}
                            {formatDuration(
                              row.peerMedianTotalRecordedDurationMs ?? null,
                            )}
                          </p>
                          <p>
                            Longest-occurrence median (legacy):{" "}
                            {formatDuration(row.peerMedianDurationMs)}
                          </p>
                        </TableCell>
                        <TableCell>
                          <div className="grid gap-1">
                            <span>
                              {row.peerPresentCount}/{peerCount};{" "}
                              {row.peerOpenRunCount ?? 0} with open;{" "}
                              {row.peerFailedRunCount ?? 0} with failures
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
                  <TableHead>Reported result</TableHead>
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
                          className="break-all font-mono text-xs hover:text-primary hover:underline"
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
  const routeParams = useSearchParams()
  const [timelineView, setTimelineView] = useState<
    "timeline" | "waterfall" | "events"
  >("timeline")
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
  const lastReport = events.find(
    (event) => event.type === "report" && event.isLatestReport,
  )
  const snapshot = buildRunSnapshot(events)
  const errors = events.filter((event) => event.type === "error")
  const operations = events.filter(
    (event) => event.type === "operation_started",
  )
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
          routeParams.get("view") === "compare" ? "compare" : "outcome"
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
              {timelineView === "waterfall" ? (
                <OperationWaterfall events={events} />
              ) : timelineView === "events" ? (
                <EventTable events={events} />
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
