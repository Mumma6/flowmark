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
import { usePathname, useSearchParams } from "next/navigation"
import {
  DataState,
  PageHeading,
  StatusBadge,
  ViewLink,
} from "../shared/dashboard-components"
import { PageSections } from "../shared/page-sections"
import { formatDuration, formatTimestamp } from "../shared/format"
import { ExpectationAttention } from "../expectations/expectation-attention"
import { windowLabel } from "../period/period"
import { PeriodControls } from "../period/period-controls"
import { failedRunsPath } from "../period/period-presentation"
import { usePeriodSelection } from "../period/use-period-selection"
import { FailureGroupsPanel } from "./failure-groups-panel"
import { issueEvidence } from "./issue-model"
import { useFailedRuns } from "./queries"

export function IssuesPage() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const issuesSourcePath = `${pathname}${searchParams.size ? `?${searchParams}` : ""}`
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
      <p className="text-sm leading-6 text-muted-foreground">
        Runs started{" "}
        {windowLabel({
          startedAfter: period.currentStartedAfter,
          startedBefore: period.currentStartedBefore,
        })}{" "}
        UTC.
      </p>
      <DataState
        pending={report.isPending}
        error={report.error}
        retry={() => void report.refetch()}
      />
      <PageSections
        label="Issue sections"
        defaultValue="failures"
        hashSections={{ "#failure-groups": "failures", "#failed-runs": "runs" }}
        sections={[
          {
            value: "failures",
            label: "Failures",
            description:
              "Start with a failure group: the same workflow and terminal failure code. Open Matching runs, then select an execution to inspect its timeline and context. Groups summarize evidence; they are not assigned or resolved here.",
            content: (
              <>
                {report.data && !report.error && (
                  <div className="grid gap-6">
                    <FailureGroupsPanel
                      groups={report.data.failureGroups}
                      truncated={report.data.failureGroupsTruncated}
                      startedAfter={period.currentStartedAfter}
                      startedBefore={period.currentStartedBefore}
                      previousStartedAfter={period.previousStartedAfter}
                      previousStartedBefore={period.previousStartedBefore}
                      sourcePath={issuesSourcePath}
                      scopedWorkflow={Boolean(workflow)}
                    />
                    <IncreasedFailures
                      items={increased.slice(0, 20)}
                      hidden={increased.length > 20}
                    />
                  </div>
                )}
              </>
            ),
          },
          {
            value: "confirmations",
            label: "Confirmations",
            description:
              "Find runs with an application-declared confirmation that has not been observed by its deadline. Follow the count to matching runs; check each run for the expected evidence and any later resolution.",
            content: (
              <ExpectationAttention
                workflow={workflow}
                startedAfter={period.currentStartedAfter}
                startedBeforeExclusive={period.currentStartedBefore}
              />
            ),
          },
          {
            value: "performance",
            label: "Slower operations",
            description:
              "Compare recorded operation durations with the previous period. Open an example run to inspect timing and context; a larger median alone does not establish an incident.",
            content: report.data && !report.error && (
              <>
                <DurationChanges
                  operations={slower}
                  workflowScoped={Boolean(workflow)}
                />
              </>
            ),
          },
          {
            value: "runs",
            label: "Failed runs",
            description:
              "Open an individual failure for its reported error and event timeline. Use the full run explorer to filter further or search by a known reference.",
            content: (
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
            ),
          },
        ]}
      />
    </div>
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
        <p className="text-sm text-muted-foreground">
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
                          className="font-mono text-sm hover:text-primary hover:underline"
                          href={`/runs/${operation.currentRunIds[0]}`}
                        >
                          {operation.currentRunIds[0].slice(0, 8)}
                        </Link>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
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
                          className="font-mono text-sm hover:text-primary hover:underline"
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
              <p className="border-t border-border px-5 py-3 text-sm text-muted-foreground">
                Showing {runs.length} of {total.toLocaleString()} failed runs.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </section>
  )
}
