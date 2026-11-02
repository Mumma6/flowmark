"use client"

import {
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
import { RefreshCw } from "lucide-react"
import Link from "next/link"
import {
  DataState,
  PageHeading,
  StatusBadge,
  ViewLink,
} from "../../components/dashboard-components"
import { formatDuration, formatTimestamp } from "../../lib/format"
import { ExpectationAttention } from "../expectations/expectation-attention"
import { windowLabel } from "../period/period"
import { PeriodControls } from "../period/period-controls"
import { failedRunsPath } from "../period/period-presentation"
import { usePeriodSelection } from "../period/use-period-selection"
import { issueEvidence } from "./issue-model"
import { useFailedRuns } from "./queries"

export function IssuesPage() {
  const { days, workflow, period, report, replace, workflowNames } =
    usePeriodSelection()
  const failed = useFailedRuns(workflow, period)
  const refresh = () => {
    void report.refetch()
    void failed.refetch()
  }
  const { increased, slower } = issueEvidence(report.data)
  return (
    <div className="grid min-w-0 gap-7">
      <PageHeading
        title="Issues"
        description="What failed, how often, when it last happened, and where to investigate."
      >
        <Button
          variant="outline"
          size="sm"
          disabled={report.isFetching || failed.isFetching}
          onClick={refresh}
        >
          <RefreshCw aria-hidden="true" />
          Refresh
        </Button>
      </PageHeading>
      <PeriodControls
        days={days}
        workflow={workflow}
        workflowNames={workflowNames}
        onChange={replace}
      />
      <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
        A failure group is derived when this page is read. It is one workflow
        plus one terminal failure code, and each failed run counts once. Groups
        are not assigned, acknowledged or resolved. An empty code means the run
        failed without a recorded code. Counts use runs started in{" "}
        {windowLabel({
          startedAfter: period.currentStartedAfter,
          startedBefore: period.currentStartedBefore,
        })}{" "}
        UTC.
      </p>
      <ExpectationAttention
        workflow={workflow}
        startedAfter={period.currentStartedAfter}
        startedBeforeExclusive={period.currentStartedBefore}
      />
      <DataState
        pending={report.isPending}
        error={report.error}
        retry={() => void report.refetch()}
      />
      {report.data && !report.error && (
        <>
          <FailureGroups
            groups={report.data.failureGroups}
            truncated={report.data.failureGroupsTruncated}
            startedAfter={period.currentStartedAfter}
            startedBefore={period.currentStartedBefore}
            scopedWorkflow={Boolean(workflow)}
          />
          <IncreasedFailures
            items={increased.slice(0, 20)}
            hidden={increased.length > 20}
          />
          <DurationChanges
            operations={slower}
            workflowScoped={Boolean(workflow)}
          />
        </>
      )}
      <FailedRuns
        pending={failed.isPending}
        error={failed.error}
        retry={() => void failed.refetch()}
        runs={failed.data?.runs ?? []}
        total={failed.data?.total ?? 0}
        href={failedRunsPath({
          workflow,
          startedAfter: period.currentStartedAfter,
          startedBefore: period.currentStartedBefore,
        })}
      />
    </div>
  )
}

function FailureGroups({
  groups,
  truncated,
  startedAfter,
  startedBefore,
  scopedWorkflow,
}: {
  groups: readonly {
    workflow: string
    code: string
    currentCount: number
    previousCount: number
    countDelta: number
    lastStartedAt: string | null
    runIds: readonly string[]
  }[]
  truncated: boolean
  startedAfter: string
  startedBefore: string
  scopedWorkflow: boolean
}) {
  return (
    <section id="failure-groups" className="grid gap-3">
      <div>
        <h2 className="text-base font-semibold">Failure groups</h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          {scopedWorkflow
            ? "Codes recorded on failed runs of this workflow."
            : "Codes recorded on failed runs, kept separate per workflow."}{" "}
          {truncated
            ? "Showing the 50 groups with the most failures in this window."
            : "Groups with no failures in this window are omitted."}
        </p>
      </div>
      <Card className="min-w-0 overflow-hidden shadow-none">
        <CardContent className="overflow-x-auto p-0">
          {groups.length === 0 ? (
            <p className="px-6 py-8 text-sm text-muted-foreground">
              No failed runs started in this window.
            </p>
          ) : (
            <Table className="min-w-[48rem]">
              <TableHeader>
                <TableRow>
                  <TableHead>What happened</TableHead>
                  <TableHead className="text-right">This window</TableHead>
                  <TableHead className="text-right">Previous</TableHead>
                  <TableHead>Last started</TableHead>
                  <TableHead>Evidence</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groups.map((group) => (
                  <TableRow
                    key={`${group.workflow}:${group.code}`}
                    className="hover:bg-muted/40"
                  >
                    <TableCell className="max-w-[280px]">
                      <p className="font-medium">
                        {group.code || "No failure code recorded"}
                      </p>
                      <Link
                        className="mt-1 block text-xs text-muted-foreground hover:text-primary hover:underline"
                        href={`/workflows/${encodeURIComponent(group.workflow)}`}
                      >
                        {group.workflow}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {group.currentCount.toLocaleString()}
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {group.countDelta > 0 ? "+" : ""}
                        {group.countDelta.toLocaleString()}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {group.previousCount.toLocaleString()}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">
                      {group.lastStartedAt
                        ? `${formatTimestamp(group.lastStartedAt)} UTC`
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-x-3 gap-y-1">
                        <Link
                          className="text-sm font-medium hover:text-primary hover:underline"
                          href={failedRunsPath({
                            workflow: group.workflow,
                            code: group.code,
                            startedAfter,
                            startedBefore,
                          })}
                        >
                          {group.code ? "Matching runs" : "Failed runs"}
                        </Link>
                        {group.runIds.slice(0, 3).map((id) => (
                          <Link
                            key={id}
                            className="font-mono text-xs text-muted-foreground hover:text-primary hover:underline"
                            href={`/runs/${id}`}
                          >
                            {id.slice(0, 8)}
                          </Link>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </section>
  )
}

function IncreasedFailures({
  items,
  hidden,
}: {
  items: readonly {
    name: string
    delta: number
    current: {
      failedRuns: number
      successRate: number | null
      finishedRuns: number
    }
    previous: { failedRuns: number }
  }[]
  hidden: boolean
}) {
  return (
    <section aria-label="Workflows with more failures" className="grid gap-3">
      <div>
        <h2 className="text-base font-semibold">
          Workflows with more failures
        </h2>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
          Failed-run counts that are higher than the previous window. A rise
          from zero is a count, not a new incident. Completion remains completed
          among finished runs.
        </p>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No workflow recorded more failed runs than in the previous window.
        </p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {items.map((item) => (
            <li key={item.name}>
              <Link
                href={`/workflows/${encodeURIComponent(item.name)}`}
                className="grid gap-1 px-5 py-4 transition-colors hover:bg-muted/40 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
              >
                <span className="font-medium">{item.name}</span>
                <span className="text-sm tabular-nums text-muted-foreground">
                  {item.current.failedRuns.toLocaleString()} failed ·{" "}
                  {item.delta > 0 ? "+" : ""}
                  {item.delta.toLocaleString()} ·{" "}
                  {item.current.finishedRuns === 0 ||
                  item.current.successRate == null
                    ? "no finished runs"
                    : `${item.current.successRate}% completion`}
                  {item.previous.failedRuns === 0
                    ? " · none in the previous window"
                    : ""}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {hidden && (
        <p className="text-xs text-muted-foreground">
          Showing 20 workflows with the largest increase.
        </p>
      )}
    </section>
  )
}

function DurationChanges({
  operations,
  workflowScoped,
}: {
  operations: readonly {
    name: string
    currentRunCount: number
    previousRunCount: number
    currentMedianDurationMs: number | null
    previousMedianDurationMs: number | null
    durationDeltaMs: number | null
    currentRunIds: readonly string[]
  }[]
  workflowScoped: boolean
}) {
  return (
    <section aria-label="Longer operations" className="grid gap-3">
      <div>
        <h2 className="text-base font-semibold">Longer recorded operations</h2>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
          Median duration compared with the previous window.
          {workflowScoped
            ? " These operations belong to the selected workflow."
            : " Without a workflow filter, the same operation name is combined across workflows."}{" "}
          A larger median is not a confirmed anomaly.
        </p>
      </div>
      {operations.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No operation has a higher median in both windows.
        </p>
      ) : (
        <Card className="overflow-hidden shadow-none">
          <CardHeader className="sr-only">
            <CardTitle>Longer recorded operations</CardTitle>
            <CardDescription>Median duration changes</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <Table className="min-w-[48rem]">
              <TableHeader>
                <TableRow>
                  <TableHead>Operation</TableHead>
                  <TableHead className="text-right">Median</TableHead>
                  <TableHead className="text-right">Previous</TableHead>
                  <TableHead className="text-right">Runs</TableHead>
                  <TableHead>Example</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {operations.map((operation) => (
                  <TableRow key={operation.name}>
                    <TableCell className="font-medium">
                      {operation.name}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatDuration(operation.currentMedianDurationMs)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {formatDuration(operation.previousMedianDurationMs)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {operation.currentRunCount.toLocaleString()} ·{" "}
                      {operation.previousRunCount.toLocaleString()} prev
                    </TableCell>
                    <TableCell>
                      {operation.currentRunIds[0] ? (
                        <Link
                          className="font-mono text-xs hover:text-primary hover:underline"
                          href={`/runs/${operation.currentRunIds[0]}`}
                        >
                          {operation.currentRunIds[0].slice(0, 8)}
                        </Link>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </section>
  )
}

function FailedRuns({
  pending,
  error,
  retry,
  runs,
  total,
  href,
}: {
  pending: boolean
  error: { message: string } | null
  retry: () => void
  runs: readonly {
    id: string
    externalId: string
    workflow: string
    startedAt: string
    failCode: string | null
    status: "Completed" | "Failed" | "Running"
  }[]
  total: number
  href: string
}) {
  return (
    <section id="failed-runs" className="grid gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Failed runs</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Individual executions in this window, newest first.
          </p>
        </div>
        <ViewLink href={href}>Open in Runs</ViewLink>
      </div>
      <DataState pending={pending} error={error} retry={retry} />
      {!pending && !error && (
        <Card className="overflow-hidden shadow-none">
          <CardContent className="overflow-x-auto p-0">
            {runs.length === 0 ? (
              <p className="px-6 py-8 text-sm text-muted-foreground">
                No failed runs started in this window.
              </p>
            ) : (
              <Table className="min-w-[48rem]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Workflow</TableHead>
                    <TableHead>Run</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Started (UTC)</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {runs.map((run) => (
                    <TableRow key={run.id} className="hover:bg-muted/40">
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
                          className="font-mono text-xs hover:text-primary hover:underline"
                          href={`/runs/${run.id}`}
                        >
                          {run.externalId.slice(0, 12)}
                        </Link>
                      </TableCell>
                      <TableCell>
                        {run.failCode ? (
                          <code>{run.failCode}</code>
                        ) : (
                          <span className="text-muted-foreground">No code</span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {formatTimestamp(run.startedAt)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={run.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            {total > runs.length && (
              <p className="border-t border-border px-5 py-3 text-xs text-muted-foreground">
                Showing {runs.length} of {total.toLocaleString()} failed runs.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </section>
  )
}
