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
import { StatusBadge, TablePagination, ViewLink } from "./dashboard-components"
import { formatDuration, formatTimestamp, paginate } from "./dashboard-data"
import { EventTable, JsonData, type RunEvent } from "./run-event-table"

type RunRelationships = inferRouterOutputs<AppRouter>["run"]["related"]
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

export function RunInvestigation({
  events,
  relationships,
  relationshipsLoading = false,
  relationshipsError,
}: {
  events: readonly RunEvent[]
  relationships?: RunRelationships
  relationshipsLoading?: boolean
  relationshipsError?: string
}) {
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
      <Card>
        <CardHeader className="flex-row flex-wrap items-start justify-between gap-4 space-y-0">
          <div>
            <CardTitle>{first.workflow}</CardTitle>
            <CardDescription>
              <code className="break-all">{first.externalId}</code>
            </CardDescription>
          </div>
          <StatusBadge status={state} />
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-wrap gap-2">
            {first.environment && (
              <Badge variant="outline">{first.environment}</Badge>
            )}
            {first.release && (
              <Badge variant="outline">Release {first.release}</Badge>
            )}
            <Badge variant="outline">
              {formatDuration(getRunDurationMs(events))}
            </Badge>
            <Badge variant="outline">{events.length} events</Badge>
          </div>
          <ViewLink href={`/workflows/${encodeURIComponent(first.workflow)}`}>
            View workflow
          </ViewLink>
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
            <CardHeader>
              <CardTitle>Event timeline</CardTitle>
              <CardDescription>
                Checkpoints, operations, progress and failures. Filter before
                expanding payloads.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <EventTable events={events} />
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
                  <dd>
                    <code>{first.correlationId ?? "Not supplied"}</code>
                  </dd>
                </div>
                <div>
                  <dt>Parent run ID</dt>
                  <dd>
                    <code>{first.parentRunId ?? "Not supplied"}</code>
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
