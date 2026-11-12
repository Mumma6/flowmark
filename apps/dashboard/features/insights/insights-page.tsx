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
import { useSearchParams } from "next/navigation"
import { LinkedProcessComparison } from "./linked/linked-process-comparison"
import {
  DataState,
  PageHeading,
  ViewLink,
} from "../shared/dashboard-components"
import {
  DailyDurationPanel,
  DailyVolumePanel,
} from "../reporting/insights-panels"
import { PageSections } from "../shared/page-sections"
import { formatDuration } from "../shared/format"
import { OverviewMetrics } from "../overview/overview-panels"
import { windowLabel } from "../period/period"
import { PeriodControls } from "../period/period-controls"
import { recordedChanges } from "../period/period-presentation"
import { RecordedChangesSection } from "../reporting/recorded-changes-section"
import { usePeriodSelection } from "../period/use-period-selection"
import { BusinessOutcomes } from "../results/outcomes/business-outcomes"

export function InsightsPage() {
  const linked = useSearchParams().get("view") === "linked"
  const { days, workflow, period, report, replace, workflowNames } =
    usePeriodSelection(!linked)
  const comparison = `previous ${days} days`
  const currentWindow = {
    startedAfter: period.currentStartedAfter,
    startedBefore: period.currentStartedBefore,
  }
  const scope = `${windowLabel(currentWindow)} · runs started · UTC`
  const changes = report.data
    ? recordedChanges({
        days,
        workflow,
        startedAfter: period.currentStartedAfter,
        startedBefore: period.currentStartedBefore,
        failureGroups: report.data.failureGroups,
        workflows: report.data.workflows,
        operations: report.data.operations,
      })
    : []
  if (linked) {
    return (
      <div className="grid min-w-0 gap-7">
        <PageHeading
          title="Insights"
          description="Compare reported results across explicitly linked processes."
        />
        <InsightsNavigation linked />
        <LinkedProcessComparison />
      </div>
    )
  }
  return (
    <div className="grid min-w-0 gap-7">
      <PageHeading
        title="Insights"
        description="How recorded work is performing, what it is accomplishing, and what changed compared with the previous window."
      >
        <Button
          variant="outline"
          size="sm"
          disabled={report.isFetching}
          onClick={() => void report.refetch()}
        >
          <RefreshCw aria-hidden="true" />
          Refresh
        </Button>
      </PageHeading>
      <InsightsNavigation linked={false} />
      <PeriodControls
        days={days}
        workflow={workflow}
        workflowNames={workflowNames}
        onChange={replace}
      />
      <p className="text-sm leading-6 text-muted-foreground">
        Runs started {windowLabel(currentWindow)} UTC · compared with the
        previous {days} days.
      </p>
      <DataState
        pending={report.isPending}
        error={report.error}
        retry={() => void report.refetch()}
      />
      {report.data && !report.error && (
        <>
          <PageSections
            label="Insights sections"
            defaultValue="summary"
            sections={[
              {
                value: "summary",
                label: "Summary & changes",
                description:
                  "Compare this period with the previous one. Follow a recorded change to the matching runs, or open Volume & duration to see when it happened. Completion measures technical execution, not business success.",
                content: (
                  <>
                    <OverviewMetrics
                      data={report.data}
                      comparison={comparison}
                      title={`Execution summary · last ${days} days`}
                    />
                    {report.data.current.totalRuns === 0 &&
                      report.data.previous.totalRuns === 0 && (
                        <Card className="border-dashed shadow-none">
                          <CardHeader>
                            <CardTitle>
                              No runs started in this window
                            </CardTitle>
                            <CardDescription>
                              {workflow
                                ? `${workflow} has no started runs in either comparison window.`
                                : "This project has no started runs in either comparison window."}
                            </CardDescription>
                          </CardHeader>
                          <CardContent>
                            {workflow ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => replace(days)}
                              >
                                Show all workflows
                              </Button>
                            ) : (
                              <ViewLink href="/settings?section=projects">
                                Open setup
                              </ViewLink>
                            )}
                          </CardContent>
                        </Card>
                      )}
                    <RecordedChangesSection changes={changes} />
                  </>
                ),
              },
              {
                value: "trends",
                label: "Volume & duration",
                description:
                  "Look for changes in started runs and execution time, then open a workflow to investigate. Days without starts show zero; differences describe recorded evidence and do not establish a cause.",
                content: (
                  <>
                    <section
                      aria-label="Volume and duration"
                      className="grid min-w-0 gap-5 xl:grid-cols-2"
                    >
                      <DailyVolumePanel
                        daily={report.data.daily}
                        scope={scope}
                        empty="No runs started in this window."
                      />
                      <DailyDurationPanel
                        daily={report.data.daily}
                        scope={scope}
                      />
                    </section>
                    <WorkflowBreakdown
                      workflows={report.data.workflows}
                      filtered={Boolean(workflow)}
                    />
                  </>
                ),
              },
              {
                value: "results",
                label: "Reported results",
                description:
                  "Choose a workflow in the filter above to inspect its application-reported outcomes in this same period. Select a result to find the executions behind it.",
                content: (
                  <>
                    {workflow ? (
                      <BusinessOutcomes
                        key={`${workflow}:${period.after}:${period.before}`}
                        workflow={workflow}
                        lockedWindow={{
                          after: period.after,
                          before: period.before,
                          days,
                        }}
                      />
                    ) : (
                      <Card className="shadow-none">
                        <CardHeader>
                          <CardTitle className="text-base">
                            Reported business outcomes
                          </CardTitle>
                          <CardDescription>
                            Outcome totals, categories, reasons and dimensions
                            are declared per workflow. Choose a workflow to
                            compare them inside this same window.
                          </CardDescription>
                        </CardHeader>
                      </Card>
                    )}
                  </>
                ),
              },
            ]}
          />
        </>
      )}
    </div>
  )
}

function WorkflowBreakdown({
  workflows,
  filtered,
}: {
  workflows: readonly {
    name: string
    current: {
      totalRuns: number
      finishedRuns: number
      failedRuns: number
      successRate: number | null
      medianDurationMs: number | null
      p95DurationMs: number | null
    }
    previous: {
      totalRuns: number
      failedRuns: number
      successRate: number | null
    }
  }[]
  filtered: boolean
}) {
  return (
    <Card className="min-w-0 overflow-hidden shadow-none">
      <CardHeader>
        <CardTitle className="text-base">
          {filtered ? "This workflow" : "By workflow"}
        </CardTitle>
        <CardDescription>
          Up to 100 workflows with the most started runs across both windows.
          Medians are calculated inside each window and are not averaged into
          the summary above.
        </CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto p-0">
        {workflows.length === 0 ? (
          <p className="px-6 py-8 text-sm text-muted-foreground">
            No workflows started a run in these windows.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Workflow</TableHead>
                <TableHead className="text-right">Started</TableHead>
                <TableHead className="text-right">Failed</TableHead>
                <TableHead className="text-right">Completion</TableHead>
                <TableHead className="hidden text-right md:table-cell">
                  Median
                </TableHead>
                <TableHead className="hidden text-right lg:table-cell">
                  p95
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {workflows.map((item) => {
                const startedDelta =
                  item.current.totalRuns - item.previous.totalRuns
                const failedDelta =
                  item.current.failedRuns - item.previous.failedRuns
                return (
                  <TableRow key={item.name} className="hover:bg-muted/40">
                    <TableCell className="max-w-[220px]">
                      <Link
                        className="font-medium hover:text-highlight hover:underline"
                        href={`/workflows/${encodeURIComponent(item.name)}`}
                      >
                        {item.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {item.current.totalRuns.toLocaleString()}
                      <span className="mt-1 block text-sm text-muted-foreground">
                        {signed(startedDelta)}
                      </span>
                    </TableCell>
                    <TableCell
                      className={`text-right tabular-nums ${failedDelta > 0 ? "text-destructive" : ""}`}
                    >
                      {item.current.failedRuns.toLocaleString()}
                      <span className="mt-1 block text-sm text-muted-foreground">
                        {signed(failedDelta)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {item.current.finishedRuns === 0 ||
                      item.current.successRate == null
                        ? "—"
                        : `${item.current.successRate}%`}
                    </TableCell>
                    <TableCell className="hidden text-right tabular-nums text-muted-foreground md:table-cell">
                      {formatDuration(item.current.medianDurationMs)}
                    </TableCell>
                    <TableCell className="hidden text-right tabular-nums text-muted-foreground lg:table-cell">
                      {formatDuration(item.current.p95DurationMs)}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}

function signed(value: number) {
  return `${value > 0 ? "+" : ""}${value.toLocaleString()} vs previous`
}

function InsightsNavigation({ linked }: { linked: boolean }) {
  return (
    <nav aria-label="Insight types" className="flex flex-wrap gap-4 text-sm">
      <Link
        href="/insights"
        aria-current={!linked ? "page" : undefined}
        className="min-h-9 py-2 text-primary hover:underline"
      >
        Workflow performance
      </Link>
      <Link
        href="/insights?view=linked"
        aria-current={linked ? "page" : undefined}
        className="min-h-9 py-2 text-primary hover:underline"
      >
        Linked process comparison
      </Link>
    </nav>
  )
}
