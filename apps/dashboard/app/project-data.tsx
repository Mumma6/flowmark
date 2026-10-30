"use client"

import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { RefreshCw } from "lucide-react"
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
  Alert,
  AlertDescription,
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
} from "@flowmark/ui"
import Link from "next/link"
import { useTRPC } from "../lib/trpc"
import { WorkflowDirectory } from "./workflow-directory"
import { ResultDeclarationEditor } from "./result-declaration-editor"
import { RunInvestigation } from "./run-investigation"
import { DataState, PageHeading, ViewLink } from "./dashboard-components"
import {
  dailyFromRuns,
  defaultIntelligenceQuery,
  formatDuration,
  formatTimestamp,
  workflowOutliers,
  type Run,
} from "./dashboard-data"
import { useProject } from "./project-context"
import {
  DailyDurationPanel,
  DailyVolumePanel,
  FailureCodeTable,
  IntelligencePanel,
  OperationInsightsTable,
} from "./insights-panels"
import { RunExplorer, RunsTable } from "./runs-table"
import {
  OverviewMetrics,
  WorkflowOverview,
  RecentFailures,
} from "./overview-panels"
import { StatusBadge } from "./dashboard-components"

function useSnapshot() {
  const trpc = useTRPC()
  const { current } = useProject()
  return useQuery({
    ...trpc.project.snapshot.queryOptions(),
    enabled: Boolean(current),
  })
}

function useIntelligence(workflow?: string) {
  const trpc = useTRPC()
  const { current } = useProject()
  const input = useMemo(() => defaultIntelligenceQuery(workflow), [workflow])
  return useQuery({
    ...trpc.project.intelligence.queryOptions(input),
    enabled: Boolean(current),
  })
}

function Refresh({
  fetching,
  onClick,
}: {
  fetching: boolean
  onClick: () => void
}) {
  return (
    <Button variant="outline" size="sm" disabled={fetching} onClick={onClick}>
      <RefreshCw aria-hidden="true" />
      Refresh
    </Button>
  )
}

function EmptyOverview() {
  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle>No runs recorded yet</CardTitle>
        <CardDescription>
          Once your application reports its first execution, this overview will
          show volume, outcomes, duration, and failure evidence.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-5">
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            Install the SDK, add a write key to your server environment, and
            report one real process to start filling this view.
          </p>
          <ViewLink href="/settings?section=projects">Open setup</ViewLink>
        </div>
      </CardContent>
    </Card>
  )
}

export function DashboardOverview() {
  const snapshot = useSnapshot()
  const intelligence = useIntelligence()
  const { data } = snapshot
  const refresh = () => {
    void snapshot.refetch()
    void intelligence.refetch()
  }
  return (
    <div className="grid min-w-0 gap-7">
      <PageHeading
        title="Overview"
        description="Understand reported workflow outcomes and find the runs behind them."
      >
        <div className="flex flex-wrap items-center gap-3 sm:flex-col sm:items-end sm:gap-2">
          <Refresh
            fetching={snapshot.isFetching || intelligence.isFetching}
            onClick={refresh}
          />
          <span className="text-xs text-muted-foreground">
            Auto-refresh · every 3 seconds
          </span>
        </div>
      </PageHeading>
      <DataState
        pending={snapshot.isPending}
        error={snapshot.error}
        retry={refresh}
      />
      {data && data.metrics.totalRuns === 0 && <EmptyOverview />}
      {data && data.metrics.totalRuns > 0 && (
        <>
          <DataState
            pending={intelligence.isPending}
            error={intelligence.error}
            retry={() => void intelligence.refetch()}
          />
          {intelligence.data && !intelligence.error && (
            <OverviewMetrics data={intelligence.data} />
          )}
          <div className="grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
            <WorkflowOverview workflows={data.workflows} />
            <RecentFailures runs={data.runs} />
          </div>
          <Card className="overflow-hidden shadow-none">
            <CardHeader className="flex-row flex-wrap items-start justify-between gap-4 space-y-0">
              <div>
                <CardTitle className="text-base">Latest runs</CardTitle>
                <CardDescription className="mt-2 text-xs">
                  Five latest executions · results reported by your application
                </CardDescription>
              </div>
              <ViewLink href="/runs">Explore runs</ViewLink>
            </CardHeader>
            <CardContent className="p-0">
              <RunsTable runs={data.runs.slice(0, 5)} />
            </CardContent>
          </Card>
          <section
            aria-label="Thirty-day trends"
            className="grid min-w-0 gap-5 xl:grid-cols-2"
          >
            <DailyVolumePanel daily={data.daily} />
            <DailyDurationPanel daily={data.daily} />
          </section>
          <IntelligencePanel
            data={intelligence.data}
            loading={intelligence.isPending}
            error={intelligence.error?.message}
          />
          <Accordion className="rounded-xl border border-border bg-card px-5">
            <AccordionItem value="diagnostics">
              <AccordionTrigger>
                All recorded diagnostics{" "}
                <span className="ml-auto text-xs font-normal text-muted-foreground">
                  Operations & failure codes
                </span>
              </AccordionTrigger>
              <AccordionContent className="max-w-none">
                <div className="grid min-w-0 gap-5 xl:grid-cols-2">
                  <OperationInsightsTable
                    operations={data.operations}
                    empty="No measured operations yet. Wrap work in operation()."
                  />
                  <FailureCodeTable
                    codes={data.failureCodes}
                    empty="No terminal failure codes reported."
                  />
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </>
      )}
    </div>
  )
}

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
  const intelligence = useIntelligence(workflow)
  const summary = data?.workflows.find((item) => item.name === workflow)
  const workflowRuns =
    workflow && data ? data.runs.filter((run) => run.workflow === workflow) : []
  const workflowDaily =
    workflow && workflowRuns.length > 0 ? dailyFromRuns(workflowRuns) : null
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
        <Refresh
          fetching={isFetching}
          onClick={() => {
            void refetch()
            if (workflow) {
              void intelligence.refetch()
            }
          }}
        />
      </PageHeading>
      {workflow && (
        <ResultDeclarationEditor key={workflow} workflow={workflow} />
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
      {workflow && workflowDaily && (
        <section
          aria-label="Workflow snapshot trends"
          className="grid min-w-0 gap-5 xl:grid-cols-2"
        >
          <DailyVolumePanel
            daily={workflowDaily}
            scope="Last 30 days within latest-100 project snapshot · UTC"
          />
          <DailyDurationPanel
            daily={workflowDaily}
            scope="Last 30 days within latest-100 project snapshot · UTC"
          />
        </section>
      )}
      {workflow && (
        <IntelligencePanel
          data={intelligence.data}
          loading={intelligence.isPending}
          error={intelligence.error?.message}
        />
      )}
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

export function ProjectWorkflows() {
  const { data, isPending, error, isFetching, refetch } = useSnapshot()
  return (
    <div className="grid min-w-0 gap-6">
      <PageHeading
        title="Workflows"
        description="Processes grouped by name prefix. Open a workflow to inspect its executions."
      >
        <Refresh fetching={isFetching} onClick={() => void refetch()} />
      </PageHeading>
      <DataState
        pending={isPending}
        error={error}
        retry={() => void refetch()}
      />
      {data && <WorkflowDirectory workflows={data.workflows} />}
    </div>
  )
}

export function RunDetail({ id }: { id: string }) {
  const trpc = useTRPC()
  const { current } = useProject()
  const { data, isPending, error, refetch } = useQuery({
    ...trpc.run.detail.queryOptions({ id }),
    enabled: Boolean(current),
  })
  const relationships = useQuery({
    ...trpc.run.related.queryOptions({ id }),
    enabled: Boolean(current),
  })
  const comparison = useQuery({
    ...trpc.run.compare.queryOptions({ id }),
    enabled: Boolean(current),
  })
  return (
    <div className="grid min-w-0 gap-6">
      <PageHeading
        title={data?.[0]?.workflow ?? "Run details"}
        description="One execution · application-reported outcome and evidence."
      >
        <ViewLink href="/runs">All runs</ViewLink>
      </PageHeading>
      <DataState
        pending={isPending}
        error={error}
        retry={() => void refetch()}
      />
      {data?.length === 0 && (
        <Alert>
          <AlertDescription>No run found in this project.</AlertDescription>
        </Alert>
      )}
      {data && data.length > 0 && (
        <RunInvestigation
          events={data}
          relationships={relationships.data}
          relationshipsLoading={relationships.isPending}
          relationshipsError={relationships.error?.message}
          comparison={comparison.data}
          comparisonLoading={comparison.isPending}
          comparisonError={comparison.error?.message}
        />
      )}
    </div>
  )
}
