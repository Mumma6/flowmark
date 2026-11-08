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
} from "@flowmark/ui"
import type { inferRouterOutputs } from "@trpc/server"
import { Match, Option } from "effect"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useState } from "react"
import { CopyButton, ViewLink } from "../shared/dashboard-components"
import { PageSections } from "../shared/page-sections"
import { RunExpectations } from "../expectations/run-expectations"
import { RunHandoff } from "./run-handoff"
import {
  evidencePageForSection,
  interpretRunSelection,
  runSelectionQueryKey,
} from "./investigation-selection"
import {
  investigationReturn,
  runInvestigationPath,
} from "./investigation-navigation"
import { JsonData } from "../shared/json-data"
import type { RunEvent } from "../platform/api-types"
import { useProject } from "../projects/project-context"
import { formatTimestamp } from "../shared/format"
import {
  buildRunExport,
  buildTimelineExport,
  stringifyExport,
} from "./run-export"
import { formatReportedProgress } from "./run-presentation"
import { BusinessResult } from "../results/business-result"
import { buildInvestigation } from "./investigation-model"
import { RunOperationsPagePanel } from "./run-operations-page-panel"
import { RunRelatedRunsPanel } from "./run-related-runs-panel"
import { RunAttempts } from "./run-attempts"
import { RunComparisonPanel } from "./run-comparison-panel"
import { RunEventPagePanel } from "./run-event-page-panel"
import { RunEventTimeline } from "./run-event-timeline"
import { ProgressStrip } from "./run-waterfall"

type RunComparison = inferRouterOutputs<AppRouter>["run"]["compare"]

export function RunInvestigation({
  runId,
  events,
  comparison,
  comparisonLoading = false,
  comparisonError,
  contextual = false,
}: {
  runId: string
  events: readonly RunEvent[]
  comparison?: RunComparison
  comparisonLoading?: boolean
  comparisonError?: string
  contextual?: boolean
}) {
  const routeParams = useSearchParams()
  const { current } = useProject()
  const source = routeParams.has("from")
    ? investigationReturn(routeParams.get("from")).href
    : undefined
  const roundTrip = interpretRunSelection({
    raw: routeParams.get(runSelectionQueryKey),
    projectId: current?.id,
    runId,
  })
  const eventsPage = Option.getOrUndefined(
    evidencePageForSection(roundTrip, "events"),
  )
  const operationsPage = Option.getOrUndefined(
    evidencePageForSection(roundTrip, "operations"),
  )
  const relatedPage = Option.getOrUndefined(
    evidencePageForSection(roundTrip, "related"),
  )
  const selectionTab =
    roundTrip._tag === "Accepted"
      ? Match.value(roundTrip.selection.section).pipe(
          Match.when("related", () => "related"),
          Match.when("expectations", () => "confirmations"),
          Match.orElse(() => "timeline"),
        )
      : undefined
  const linkedEventId = events.find(
    (event) => event.id === routeParams.get("event"),
  )?.id
  const [evidenceSelection, setEvidenceSelection] = useState<
    { id: string; revision: number } | undefined
  >(linkedEventId ? { id: linkedEventId, revision: 0 } : undefined)
  const [timelineView, setTimelineView] = useState<
    "timeline" | "waterfall" | "events"
  >(
    linkedEventId
      ? "events"
      : roundTrip._tag === "Accepted" &&
          roundTrip.selection.section === "operations"
        ? "waterfall"
        : roundTrip._tag === "Accepted" &&
            roundTrip.selection.section === "events"
          ? "events"
          : "timeline",
  )
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
      {roundTrip._tag === "Rejected" ? (
        <Alert>
          <AlertTitle>Selection not applied</AlertTitle>
          <AlertDescription>{roundTrip.message}</AlertDescription>
        </Alert>
      ) : null}
      <PageSections
        compact={contextual}
        history={contextual ? "replace" : "push"}
        label="Run investigation sections"
        defaultValue={linkedEventId ? "timeline" : (selectionTab ?? "summary")}
        sections={[
          {
            value: "summary",
            label: "Run summary",
            description:
              "Start with this execution’s status and reported highlights. Inspect a milestone, use the tabs for more evidence, then take an investigation summary back to your application.",
            content: (
              <>
                {snapshot && (
                  <div
                    className={
                      contextual
                        ? ""
                        : "[&_p]:text-sm [&_dt]:text-sm [&_dd+dd]:text-sm [&_h3]:text-base [&_pre]:text-sm [&_button_span]:text-sm"
                    }
                  >
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
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <ViewLink
                    href={runInvestigationPath(runId, source, "timeline")}
                    replace={contextual}
                  >
                    Inspect the timeline
                  </ViewLink>
                  <ViewLink
                    href={runInvestigationPath(runId, source, "handoff")}
                    replace={contextual}
                  >
                    Take findings forward
                  </ViewLink>
                </div>
              </>
            ),
          },
          {
            value: "outcome",
            label: "Reported results",
            description:
              "Check the final reported result separately from technical completion. Use the timeline to inspect how the execution reached this outcome.",
            content: (
              <>
                {failure && (
                  <Alert variant="destructive">
                    <AlertTitle>
                      {failure.error?.code ?? "Run failed"}
                    </AlertTitle>
                    <AlertDescription>
                      {failure.error?.message ??
                        failure.reason ??
                        "No failure message recorded."}
                      {failure.error?.retryable !== undefined && (
                        <p>
                          Reported retryable:{" "}
                          {failure.error.retryable ? "yes" : "no"}. Flowmark
                          does not retry this work.
                        </p>
                      )}
                    </AlertDescription>
                  </Alert>
                )}
                {state === "Running" && (
                  <Alert>
                    <AlertTitle>No final outcome recorded</AlertTitle>
                    <AlertDescription>
                      The run may still be active, or telemetry may have
                      stopped. Check application logs before retrying.
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
                        Latest received non-final whole snapshot. Missing fields
                        are unknown. This observation does not prove the run is
                        active or failed.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <dl className="grid gap-3 text-sm sm:grid-cols-2">
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
                          events.find((event) => event.type === "started")
                            ?.properties
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
                    <CardTitle className="text-base">
                      Final reported result
                    </CardTitle>
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
                        events.find((event) => event.type === "started")
                          ?.properties
                      }
                    />
                    {reportedResult == null && (
                      <p className="text-sm leading-6 text-muted-foreground">
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
                    <CardTitle className="text-base">
                      Recorded evidence
                    </CardTitle>
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
                          events.filter(
                            (event) => event.type === "operation_failed",
                          ).length
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
                    <p className="py-3 text-sm leading-6 text-muted-foreground">
                      A handled error or failed operation does not by itself
                      fail the workflow. Inspect the timeline and use recorded
                      identifiers to continue in your application logs.
                    </p>
                  </CardContent>
                </Card>
              </>
            ),
          },
          {
            value: "timeline",
            label: "Timeline",
            description:
              "Follow events in order. Expand an event for its payload, or switch to Operations to inspect recorded durations and gaps.",
            content: (
              <>
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
                          ? "Recorded operations load in bounded pages. Use the event timeline for full interval overlap."
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
                        variant={
                          timelineView === "events" ? "secondary" : "outline"
                        }
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
                      <RunOperationsPagePanel
                        runId={runId}
                        page={operationsPage}
                      />
                    ) : timelineView === "events" ? (
                      <RunEventPagePanel
                        runId={runId}
                        initialEventId={evidenceSelection?.id}
                        page={eventsPage}
                      />
                    ) : (
                      <RunEventTimeline events={events} />
                    )}
                  </CardContent>
                </Card>
              </>
            ),
          },
          {
            value: "context",
            label: "Context",
            description:
              "Use the recorded environment, release and business identifiers to find the same execution in your application logs.",
            content: (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Run context</CardTitle>
                    <CardDescription>
                      Latest shallow merge of initial properties and context
                      amendments. Event history stays unchanged.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <dl className="mb-5 grid gap-4 text-sm sm:grid-cols-2 [&_dt]:text-muted-foreground [&_dd]:mt-1 [&_dd]:break-all">
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
                      <p className="text-sm text-muted-foreground">
                        No properties recorded.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </>
            ),
          },
          {
            value: "compare",
            label: "Compare",
            description:
              "Compare this execution with another recorded run of the same workflow. Differences are evidence to investigate, not a confirmed cause.",
            content: (
              <>
                <RunComparisonPanel
                  source={source}
                  replace={contextual}
                  comparison={comparison}
                  loading={comparisonLoading}
                  error={comparisonError}
                />
              </>
            ),
          },
          {
            value: "related",
            label: "Related runs",
            description:
              "Follow explicit application-declared links to earlier attempts, parents or runs sharing a correlation. Each run has its own status and result.",
            content: (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle>Explicit run links</CardTitle>
                    <CardDescription>
                      Application-declared associations, not proof of causation
                      or a distributed trace. Browser-supplied links are
                      untrusted.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <dl className="mb-5 grid gap-4 text-sm sm:grid-cols-2 [&_dt]:text-muted-foreground [&_dd]:mt-1 [&_dd]:break-all">
                      <div>
                        <dt>Correlation ID</dt>
                        <dd className="flex flex-wrap items-center gap-2">
                          {first.correlationId ? (
                            <>
                              <Link
                                className="font-medium hover:text-highlight hover:underline"
                                href={`/runs?search=${encodeURIComponent(first.correlationId)}`}
                              >
                                <code>{first.correlationId}</code>
                              </Link>
                              <CopyButton
                                value={first.correlationId}
                                label="Copy"
                              />
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
                                className="font-medium hover:text-highlight hover:underline"
                                href={`/runs?search=${encodeURIComponent(first.parentRunId)}`}
                              >
                                <code>{first.parentRunId}</code>
                              </Link>
                              <CopyButton
                                value={first.parentRunId}
                                label="Copy"
                              />
                            </>
                          ) : (
                            <code>Not supplied</code>
                          )}
                        </dd>
                      </div>
                    </dl>
                    <RunRelatedRunsPanel
                      runId={runId}
                      source={source}
                      replace={contextual}
                      retryOf={first.retryOf}
                      correlationId={first.correlationId}
                      parentRunId={first.parentRunId}
                      page={relatedPage}
                    />
                  </CardContent>
                </Card>
              </>
            ),
          },
          {
            value: "confirmations",
            label: "Confirmations",
            description:
              "Inspect the confirmations this application expected and any observed resolutions. A completed run can still be waiting for a confirmation.",
            content: (
              <RunExpectations
                id={runId}
                source={source}
                replace={contextual}
              />
            ),
          },
          {
            value: "handoff",
            label: "Take findings forward",
            description:
              "Finish with a factual record of this execution. Copy the investigation summary for an issue or application-log search, and add your own diagnosis after checking the evidence.",
            content: (
              <RunHandoff
                runId={runId}
                events={events}
                contextual={contextual}
              />
            ),
          },
        ]}
      />
    </div>
  )
}
