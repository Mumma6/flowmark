"use client"

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
import { formatDuration, type WorkflowSummary } from "./dashboard-data"
import { EmptyProject } from "./empty-project"
import { OnboardingGuide } from "./getting-started"
import { useProject } from "./project-context"
import {
  DailyDurationPanel,
  DailyVolumePanel,
  FailureCodeTable,
  OperationInsightsTable,
  WeekOverWeek,
} from "./insights-panels"
import { RunExplorer, RunsTable } from "./runs-table"

function useSnapshot() {
  const trpc = useTRPC()
  const { current } = useProject()
  return useQuery({
    ...trpc.project.snapshot.queryOptions(),
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
      <OnboardingGuide />
      <DataState
        pending={isPending}
        error={error}
        retry={() => void refetch()}
      />
      {data && data.metrics.totalRuns === 0 ? <EmptyProject /> : null}
      {data && data.metrics.totalRuns > 0 && (
        <>
          <section
            className="grid grid-cols-2 gap-3 xl:grid-cols-5"
            aria-label="Project metrics"
          >
            {cards.map(({ label, value, icon: Icon, note }) => (
              <Card key={label}>
                <CardHeader className="flex-row items-center justify-between gap-2 space-y-0 p-4 text-xs text-muted-foreground sm:p-6 sm:text-sm">
                  <span>{label}</span>
                  <Icon size={17} aria-hidden="true" />
                </CardHeader>
                <CardContent className="px-4 pb-4 sm:px-6 sm:pb-6">
                  <strong className="mb-2 block text-2xl font-semibold tracking-tight sm:text-3xl">
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
          <Card>
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
    </div>
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
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">
            {summary.runs.toLocaleString()} recorded runs
          </Badge>
          <Badge variant="outline">
            {summary.successRate === null
              ? "No finished runs"
              : `${summary.successRate}% success`}
          </Badge>
          <Badge variant="outline">
            Median {formatDuration(summary.medianDurationMs)}
          </Badge>
          <Badge variant="outline">
            p95 {formatDuration(summary.p95DurationMs)}
          </Badge>
        </div>
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
      <Alert>
        <AlertDescription>
          History below covers the project’s latest 100 runs
          {workflow ? ", filtered to this workflow" : ""}. Filters and
          pagination apply to that snapshot, not the full database history.
        </AlertDescription>
      </Alert>
      {data && (
        <Card>
          <CardHeader>
            <CardTitle>{workflow ? "Workflow runs" : "Run explorer"}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <RunExplorer
              key={`${workflow ?? "all"}:${initialSearch}`}
              runs={data.runs}
              workflow={workflow}
              initialSearch={initialSearch}
            />
          </CardContent>
        </Card>
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
