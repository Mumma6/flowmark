"use client"

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
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
} from "@flowmark/ui"
import Link from "next/link"
import {
  DataState,
  PageHeading,
  StatusBadge,
  ViewLink,
} from "../shared/dashboard-components"
import { Refresh } from "../shared/refresh"
import {
  FailureCodeTable,
  OperationInsightsTable,
} from "../reporting/insights-panels"
import { type Run } from "../platform/api-types"
import { formatDuration, formatTimestamp } from "../shared/format"
import { ExpectationAttention } from "../expectations/expectation-attention"
import { insightsPath, issuesPath } from "../period/period-presentation"
import { useSnapshot } from "../projects/queries"
import { BusinessOutcomes } from "../results/business-outcomes"
import { ResultDeclarationEditor } from "../results/result-declaration-editor"
import { WorkflowSearchFields } from "../results/workflow-search-fields"
import { RunExplorer } from "./run-explorer"
import { workflowOutliers } from "./run-filters"

function WorkflowOutlierLinks({
  title,
  runs,
  empty,
}: {
  title: string
  runs: readonly Run[]
  empty: string
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>
          From the latest-100 project snapshot filtered to this workflow — not
          all-time history.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {runs.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-muted-foreground">
            {empty}
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Run</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Started (UTC)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.map((run) => (
                <TableRow key={run.id}>
                  <TableCell>
                    <Link
                      className="font-medium hover:text-primary hover:underline"
                      href={`/runs/${run.id}`}
                    >
                      <code>{run.externalId.slice(0, 12)}</code>
                    </Link>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={run.status} />
                  </TableCell>
                  <TableCell>{formatDuration(run.durationMs)}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {formatTimestamp(run.startedAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}

export function ProjectRuns({
  workflow,
  initialSearch = "",
}: {
  workflow?: string
  initialSearch?: string
}) {
  const { data, isPending, error, isFetching, refetch } = useSnapshot()
  const summary = data?.workflows.find((item) => item.name === workflow)
  const workflowRuns =
    workflow && data ? data.runs.filter((run) => run.workflow === workflow) : []
  const outliers =
    workflow && workflowRuns.length > 0 ? workflowOutliers(workflowRuns) : null
  return (
    <div className="grid min-w-0 gap-6">
      <PageHeading
        title={workflow ?? "Runs"}
        description={
          workflow
            ? "Reported results and execution history for this workflow."
            : "Find an execution by run ID, workflow, failure code or recorded correlation."
        }
      >
        <Refresh fetching={isFetching} onClick={() => void refetch()} />
      </PageHeading>
      {workflow && (
        <>
          <ExpectationAttention workflow={workflow} />
          <BusinessOutcomes key={`outcomes:${workflow}`} workflow={workflow} />
          <WorkflowSearchFields
            key={`search:${workflow}`}
            workflow={workflow}
          />
          <ResultDeclarationEditor key={workflow} workflow={workflow} />
        </>
      )}
      <DataState
        pending={isPending}
        error={error}
        retry={() => void refetch()}
      />
      {workflow && summary && (
        <section aria-label="Workflow execution summary" className="grid gap-3">
          <p className="text-xs text-muted-foreground">
            Execution summary · all recorded runs
          </p>
          <dl className="grid grid-cols-2 gap-5 border-y border-border py-5 sm:grid-cols-4 [&_dt]:text-xs [&_dt]:text-muted-foreground [&_dd]:mt-2 [&_dd]:text-2xl [&_dd]:font-medium [&_dd]:tabular-nums">
            <div>
              <dt>Recorded runs</dt>
              <dd>{summary.runs.toLocaleString()}</dd>
            </div>
            <div>
              <dt>Run completion</dt>
              <dd>
                {summary.successRate == null ? "—" : `${summary.successRate}%`}
              </dd>
            </div>
            <div>
              <dt>Median duration</dt>
              <dd>{formatDuration(summary.medianDurationMs)}</dd>
            </div>
            <div>
              <dt>p95 duration</dt>
              <dd>{formatDuration(summary.p95DurationMs)}</dd>
            </div>
          </dl>
          <p className="text-xs leading-5 text-muted-foreground">
            Run completion is among finished runs, not a measure of business
            success. Reported results appear with each execution below.
          </p>
          <div className="flex flex-wrap gap-2">
            <ViewLink href={insightsPath(7, workflow)}>
              Trends for this workflow
            </ViewLink>
            <ViewLink href={issuesPath(7, workflow)}>
              Problems for this workflow
            </ViewLink>
          </div>
        </section>
      )}
      <Card className="overflow-hidden shadow-none">
        <CardHeader>
          <CardTitle className="text-base">
            {workflow ? "Workflow runs & reported results" : "Run history"}
          </CardTitle>
          <CardDescription className="text-xs">
            Full recorded history · filters apply to this list
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <RunExplorer
            key={`${workflow ?? "all"}:${initialSearch}`}
            workflow={workflow}
            workflowNames={data?.workflows.map((item) => item.name) ?? []}
            initialSearch={initialSearch}
          />
        </CardContent>
      </Card>
      {workflow && data && (
        <Accordion className="rounded-xl border border-border bg-card px-5">
          <AccordionItem value="workflow-evidence">
            <AccordionTrigger>
              Technical evidence & diagnostics
            </AccordionTrigger>
            <AccordionContent className="max-w-none">
              {outliers && (
                <div className="mb-5 grid min-w-0 gap-5 xl:grid-cols-2">
                  <WorkflowOutlierLinks
                    title="Recent failures"
                    runs={outliers.failed}
                    empty="No failed runs in the latest-100 slice for this workflow."
                  />
                  <WorkflowOutlierLinks
                    title="Longest durations"
                    runs={outliers.longest}
                    empty="No timed runs in the latest-100 slice for this workflow."
                  />
                </div>
              )}
              <p className="mb-3 text-xs text-muted-foreground">
                All recorded operations & failure codes
              </p>
              <div className="grid min-w-0 gap-5 xl:grid-cols-2">
                <OperationInsightsTable
                  operations={data.operations.filter(
                    (item) => item.workflow === workflow,
                  )}
                  empty="No measured operations on this workflow yet."
                />
                <FailureCodeTable
                  codes={data.failureCodes.filter(
                    (item) => item.workflow === workflow,
                  )}
                  empty="No terminal failure codes reported on this workflow."
                />
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}
    </div>
  )
}
