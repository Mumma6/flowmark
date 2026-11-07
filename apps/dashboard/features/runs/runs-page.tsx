"use client"

import {
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
import { useSearchParams } from "next/navigation"
import { Array as EffectArray } from "effect"
import { explorerDefaults } from "./explorer-filters"
import {
  DataState,
  PageHeading,
  StatusBadge,
  ViewLink,
} from "../shared/dashboard-components"
import { PageSections } from "../shared/page-sections"
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
                      className="font-medium hover:text-highlight hover:underline"
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
  const params = useSearchParams()
  const hasRunFilters = EffectArray.some(
    EffectArray.fromIterable(Object.keys(explorerDefaults)),
    (key) => params.has(key),
  )
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
      <DataState
        pending={isPending}
        error={error}
        retry={() => void refetch()}
      />
      <PageSections
        label={workflow ? "Workflow sections" : "Run history sections"}
        defaultValue={workflow && !hasRunFilters ? "overview" : "runs"}
        sections={[
          ...(workflow
            ? [
                {
                  value: "overview",
                  label: "Overview",
                  description:
                    "Check the execution summary, then choose Runs to inspect individual evidence or Reported results to see what the application reported accomplishing.",
                  content: (
                    <>
                      {workflow && summary && (
                        <section
                          aria-label="Workflow execution summary"
                          className="grid gap-3"
                        >
                          <p className="text-sm text-muted-foreground">
                            Execution summary · all recorded runs
                          </p>
                          <dl className="grid grid-cols-2 gap-5 border-y border-border py-5 sm:grid-cols-4 [&_dt]:text-sm [&_dt]:text-muted-foreground [&_dd]:mt-2 [&_dd]:text-2xl [&_dd]:font-medium [&_dd]:tabular-nums">
                            <div>
                              <dt>Recorded runs</dt>
                              <dd>{summary.runs.toLocaleString()}</dd>
                            </div>
                            <div>
                              <dt>Run completion</dt>
                              <dd>
                                {summary.successRate == null
                                  ? "—"
                                  : `${summary.successRate}%`}
                              </dd>
                            </div>
                            <div>
                              <dt>Median duration</dt>
                              <dd>
                                {formatDuration(summary.medianDurationMs)}
                              </dd>
                            </div>
                            <div>
                              <dt>p95 duration</dt>
                              <dd>{formatDuration(summary.p95DurationMs)}</dd>
                            </div>
                          </dl>
                          <p className="text-sm leading-5 text-muted-foreground">
                            Run completion is among finished runs, not a measure
                            of business success. Open Reported results for
                            business outcomes; open a run for the individual
                            evidence.
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
                    </>
                  ),
                },
              ]
            : []),
          {
            value: "runs",
            label: "Runs",
            description:
              "Filter the recorded history, then open a run to inspect its outcome and timeline. Filter chips show every condition currently applied.",
            keepMounted: true,
            content: (
              <Card className="overflow-hidden shadow-none">
                <CardContent className="p-0">
                  <RunExplorer
                    key={`${workflow ?? "all"}:${initialSearch}`}
                    workflow={workflow}
                    workflowNames={
                      data?.workflows.map((item) => item.name) ?? []
                    }
                    initialSearch={initialSearch}
                  />
                </CardContent>
              </Card>
            ),
          },
          ...(workflow
            ? [
                {
                  value: "results",
                  label: "Reported results",
                  description:
                    "See what the application reported accomplishing. Open matching runs from a result to inspect the evidence behind the total.",
                  content: (
                    <BusinessOutcomes
                      key={`outcomes:${workflow}`}
                      workflow={workflow}
                    />
                  ),
                },
                {
                  value: "confirmations",
                  label: "Confirmations",
                  description:
                    "Find work waiting for an application-declared confirmation. Overdue means no resolution has been observed by the deadline; open the matching runs to investigate.",
                  content: <ExpectationAttention workflow={workflow} />,
                },
                {
                  value: "diagnostics",
                  label: "Diagnostics",
                  description:
                    "Inspect recent failure examples and long durations, then open a run for the sequence of operations and recorded errors.",
                  content: data && (
                    <div className="grid gap-5">
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
                      <p className="mb-3 text-sm text-muted-foreground">
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
                    </div>
                  ),
                },
                {
                  value: "configuration",
                  label: "Configuration",
                  description:
                    "Choose which application-reported fields appear as results and which references users can search. These settings describe existing telemetry.",
                  content: (
                    <>
                      <WorkflowSearchFields
                        key={`search:${workflow}`}
                        workflow={workflow}
                      />
                      <ResultDeclarationEditor
                        key={workflow}
                        workflow={workflow}
                      />
                    </>
                  ),
                },
              ]
            : [
                {
                  value: "search-help",
                  label: "Find the right evidence",
                  description:
                    "Start with the identifier or question you have, narrow the list, then open a run. Finish by copying its investigation summary to take the evidence back to your application.",
                  content: (
                    <div className="grid gap-5 md:grid-cols-3">
                      <section className="rounded-xl border border-border bg-card p-5">
                        <h2 className="text-lg font-semibold">
                          I have an identifier
                        </h2>
                        <p className="mt-3 text-base leading-7 text-muted-foreground">
                          Search by run ID or correlation. For an
                          application-specific reference, choose a workflow and
                          open the Business reference filter. Values match
                          exactly.
                        </p>
                      </section>
                      <section className="rounded-xl border border-border bg-card p-5">
                        <h2 className="text-lg font-semibold">
                          I want to find affected runs
                        </h2>
                        <p className="mt-3 text-base leading-7 text-muted-foreground">
                          Combine execution status and dates with reported
                          results or technical context. Every filter group
                          narrows the same list; the chips show all active
                          conditions.
                        </p>
                      </section>
                      <section className="rounded-xl border border-border bg-card p-5">
                        <h2 className="text-lg font-semibold">
                          I found the run
                        </h2>
                        <p className="mt-3 text-base leading-7 text-muted-foreground">
                          Check its summary and reported result, follow the
                          timeline, then inspect Context or Related runs. Take
                          findings forward gives you a factual summary to copy
                          into your next investigation step.
                        </p>
                      </section>
                    </div>
                  ),
                },
              ]),
        ]}
      />
    </div>
  )
}
