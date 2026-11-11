"use client"

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
} from "@flowmark/ui"
import { JsonData } from "../../../shared/json-data"
import { formatTimestamp } from "../../../shared/format"
import { formatReportedProgress } from "../../models/run-presentation"
import { BusinessResult } from "../../../results/presentation/business-result"
import { ProgressStrip } from "../../timeline/run-waterfall"
import type { InvestigationSectionProps } from "../investigation-types"

export function OutcomeSection({
  first,
  failure,
  completed,
  state,
  progress,
  reportedResult,
  lastReport,
  errors,
  operations,
  events,
}: Pick<
  InvestigationSectionProps,
  | "first"
  | "failure"
  | "completed"
  | "state"
  | "progress"
  | "reportedResult"
  | "lastReport"
  | "errors"
  | "operations"
  | "events"
>) {
  return (
    <>
      {failure && (
        <Alert variant="destructive">
          <AlertTitle>{failure.error?.code ?? "Run failed"}</AlertTitle>
          <AlertDescription>
            {failure.error?.message ??
              failure.reason ??
              "No failure message recorded."}
            {failure.error?.retryable !== undefined && (
              <p>
                Reported retryable: {failure.error.retryable ? "yes" : "no"}.
                Flowmark does not retry this work.
              </p>
            )}
          </AlertDescription>
        </Alert>
      )}
      {state === "Running" && (
        <Alert>
          <AlertTitle>No final outcome recorded</AlertTitle>
          <AlertDescription>
            The run may still be active, or telemetry may have stopped. Check
            application logs before retrying.
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
            <Badge variant="secondary">{operations.length} operations</Badge>
            <Badge variant="secondary">
              {
                events.filter((event) => event.type === "operation_failed")
                  .length
              }{" "}
              failed operations
            </Badge>
            <Badge variant="secondary">{errors.length} observed errors</Badge>
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
            A handled error or failed operation does not by itself fail the
            workflow. Inspect the timeline and use recorded identifiers to
            continue in your application logs.
          </p>
        </CardContent>
      </Card>
    </>
  )
}
