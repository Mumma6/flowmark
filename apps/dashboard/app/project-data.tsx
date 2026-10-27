"use client"

import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { Activity, Check, Clock3, RefreshCw, ShieldAlert } from "lucide-react"
import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Skeleton,
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
import { RunInvestigation } from "./run-investigation"
import { DataState, PageHeading, ViewLink } from "./dashboard-components"
import {
  dailyFromRuns,
  defaultIntelligenceQuery,
  formatDuration,
  formatTimestamp,
  weekOverWeek,
  workflowOutliers,
  type Run,
  type WorkflowSummary,
} from "./dashboard-data"
import { useProject } from "./project-context"
import {
  DailyDurationPanel,
  DailyVolumePanel,
  FailureCodeTable,
  IntelligencePanel,
  OperationInsightsTable,
  WeekOverWeek,
} from "./insights-panels"
import { RunExplorer, RunsTable } from "./runs-table"
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
        <div
          className="grid grid-cols-2 gap-3 xl:grid-cols-5"
          aria-hidden="true"
        >
          {["w-2/3", "w-1/2", "w-3/4", "w-1/2", "w-2/3"].map((width, index) => (
            <div
              className="grid gap-3 rounded-lg border border-border/70 p-4"
              key={index}
            >
              <Skeleton className={`h-3 ${width}`} />
              <Skeleton className="h-8 w-1/2" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          ))}
        </div>
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

function WorkflowHealth({
  workflows,
}: {
  workflows: readonly WorkflowSummary[]
}) {
  const attention = [...workflows]
    .sort(
      (a, b) =>
        (a.successRate ?? 101) - (b.successRate ?? 101) || b.runs - a.runs,
    )
    .slice(0, 5)
  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle>Workflow outcomes</CardTitle>
          <CardDescription className="mt-2 leading-6">
            Lowest success rates among finished runs. Business results may still
            need attention.
          </CardDescription>
        </div>
        <ViewLink href="/workflows">All workflows</ViewLink>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Workflow</TableHead>
              <TableHead>Runs</TableHead>
              <TableHead>Success</TableHead>
              <TableHead>p95</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {attention.map((item) => (
              <TableRow key={item.name}>
                <TableCell>
                  <Link
                    className="font-medium hover:text-primary hover:underline"
                    href={`/workflows/${encodeURIComponent(item.name)}`}
                  >
                    {item.name}
                  </Link>
                </TableCell>
                <TableCell>{item.runs}</TableCell>
                <TableCell>
                  {item.successRate === null
                    ? "Not reported"
                    : `${item.successRate}%`}
                </TableCell>
                <TableCell>{formatDuration(item.p95DurationMs)}</TableCell>
              </TableRow>
            ))}
            {attention.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="px-5 py-8 text-center text-sm text-muted-foreground"
                >
                  No workflows recorded yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

export function DashboardOverview() {
  const { data, isPending, error, isFetching, refetch } = useSnapshot()
  const intelligence = useIntelligence()
  const metrics = data?.metrics
  const cards = [
    {
      label: "Recorded runs",
      value: metrics?.totalRuns.toLocaleString() ?? "—",
      icon: Activity,
      note: "All recorded runs",
    },
    {
      label: "Completed",
      value: metrics?.successRate == null ? "—" : `${metrics.successRate}%`,
      icon: Check,
      note: "Among finished runs",
    },
    {
      label: "Median duration",
      value: metrics ? formatDuration(metrics.medianDurationMs) : "—",
      icon: Clock3,
      note: "Typical finished run",
    },
    {
      label: "p95 duration",
      value: metrics ? formatDuration(metrics.p95DurationMs) : "—",
      icon: Clock3,
      note: "Slow finished runs",
    },
    {
      label: "Failed runs",
      value: metrics?.failedRuns.toLocaleString() ?? "—",
      icon: ShieldAlert,
      note: "Application-reported failure",
    },
  ]
  return (
    <div className="grid min-w-0 gap-6">
      <PageHeading
        title="Overview"
        description="Volume, success rate, duration, operations, and failure codes. Refreshes every 3 seconds."
      >
        <Refresh fetching={isFetching} onClick={() => void refetch()} />
      </PageHeading>
      <DataState
        pending={isPending}
        error={error}
        retry={() => void refetch()}
      />
      {data && data.metrics.totalRuns > 0 && (
        <>
          <section
            className="grid grid-cols-2 gap-3 xl:grid-cols-5"
            aria-label="Project metrics"
          >
            {cards.map(({ label, value, icon: Icon, note }) => (
              <Card key={label} className="overflow-hidden">
                <CardHeader className="flex-row items-center justify-between gap-2 space-y-0 p-4 text-[11px] uppercase tracking-[0.08em] text-muted-foreground sm:p-5">
                  <span>{label}</span>
                  <Icon
                    size={16}
                    className="text-primary/80"
                    aria-hidden="true"
                  />
                </CardHeader>
                <CardContent className="px-4 pb-4 sm:px-5 sm:pb-5">
                  <strong className="mb-2 block text-2xl font-medium tracking-tight sm:text-3xl">
                    {value}
                  </strong>
                  <p className="text-xs leading-6 text-muted-foreground">
                    {note}
                  </p>
                </CardContent>
              </Card>
            ))}
          </section>
          <WeekOverWeek daily={data.daily} runs={data.runs} />
          <IntelligencePanel
            data={intelligence.data}
            loading={intelligence.isPending}
            error={intelligence.error?.message}
          />
          <DailyVolumePanel daily={data.daily} />
          <div className="grid min-w-0 gap-5 xl:grid-cols-2">
            <DailyDurationPanel daily={data.daily} />
            <WorkflowHealth workflows={data.workflows} />
          </div>
          <div className="grid min-w-0 gap-5 xl:grid-cols-2">
            <OperationInsightsTable
              operations={data.operations}
              empty="No measured operations yet. Wrap slow work in operation()."
            />
            <FailureCodeTable
              codes={data.failureCodes}
              empty="No fail({ code }) reports yet."
            />
          </div>
          <Card className="overflow-hidden">
            <CardHeader className="flex-row flex-wrap items-start justify-between gap-4 space-y-0">
              <div>
                <CardTitle>Latest runs</CardTitle>
                <CardDescription className="mt-2 leading-6">
                  Five recent executions. Open a run for its result and
                  evidence.
                </CardDescription>
              </div>
              <ViewLink href="/runs">Explore runs</ViewLink>
            </CardHeader>
            <CardContent className="p-0">
              <RunsTable runs={data?.runs.slice(0, 5) ?? []} />
            </CardContent>
          </Card>
        </>
      )}
      {data && data.metrics.totalRuns === 0 && <EmptyOverview />}
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
  const wow = workflowDaily != null ? weekOverWeek(workflowDaily) : null
  return (
    <div className="grid min-w-0 gap-6">
      <PageHeading
        title={workflow ?? "Runs"}
        description={
          workflow
            ? "Execution history and reported outcomes for this workflow."
            : "Find an execution by workflow, status, namespace or correlation ID."
        }
      >
        <Refresh fetching={isFetching} onClick={() => void refetch()} />
      </PageHeading>
      <DataState
        pending={isPending}
        error={error}
        retry={() => void refetch()}
      />
      {workflow && summary && (
        <div className="grid gap-3">
          <div className="flex flex-wrap gap-2">
            <Badge
              variant="outline"
              title="All-time recorded runs for this workflow name"
            >
              {summary.runs.toLocaleString()} recorded runs · all time
            </Badge>
            <Badge
              variant="outline"
              title="Among finished runs. Incomplete runs are not failures."
            >
              {summary.successRate === null
                ? "No finished runs"
                : `${summary.successRate}% success among finished`}
            </Badge>
            <Badge variant="outline">
              Median {formatDuration(summary.medianDurationMs)} · all time
            </Badge>
            <Badge variant="outline">
              p95 {formatDuration(summary.p95DurationMs)} · all time
            </Badge>
          </div>
          <p className="text-xs leading-6 text-muted-foreground">
            Summary badges use all recorded runs for this workflow. Charts and
            the explorer below use the latest-100 project snapshot filtered to
            this name ({workflowRuns.length} in that slice).
          </p>
          {wow && (
            <p className="text-xs leading-6 text-muted-foreground">
              Last 7 days in this slice: {wow.current.count} runs
              {wow.current.successRate != null
                ? ` · ${wow.current.successRate}% success among finished`
                : ""}
              . Week-over-week volume change is only meaningful inside the
              latest-100 window.
            </p>
          )}
        </div>
      )}
      {workflow && (
        <IntelligencePanel
          data={intelligence.data}
          loading={intelligence.isPending}
          error={intelligence.error?.message}
        />
      )}
      {workflow && data && (
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
            empty="No fail({ code }) reports on this workflow yet."
          />
        </div>
      )}
      {workflow && workflowDaily && (
        <div className="grid min-w-0 gap-5 xl:grid-cols-2">
          <DailyVolumePanel daily={workflowDaily} />
          <DailyDurationPanel daily={workflowDaily} />
        </div>
      )}
      {workflow && outliers && (
        <div className="grid min-w-0 gap-5 xl:grid-cols-2">
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
      <Alert>
        <AlertDescription>
          {workflow
            ? "Run explorer pages the full project history for this workflow. Summary badges above are all-time aggregates. Charts and outlier tables still use the latest-100 snapshot slice."
            : "Run explorer pages the full project history with server-side filters. Overview charts still use the latest-100 snapshot plus 30-day aggregates."}
        </AlertDescription>
      </Alert>
      <Card>
        <CardHeader>
          <CardTitle>{workflow ? "Workflow runs" : "Run explorer"}</CardTitle>
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
        title="Run details"
        description="Reported outcome, recorded evidence and related executions."
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
