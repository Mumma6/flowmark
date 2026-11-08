"use client"

import { Card, CardDescription, CardHeader, CardTitle } from "@flowmark/ui"
import { ArrowUpRight } from "lucide-react"
import Link from "next/link"
import { OverviewMetrics } from "../overview/overview-panels"
import {
  exploreCohortHref,
  mapRecordedChangeHrefs,
} from "../period/cohort-navigation"
import { windowLabel } from "../period/period"
import { PeriodControls } from "../period/period-controls"
import {
  failedRunsPath,
  insightsPath,
  issuesPath,
  recordedChanges,
} from "../period/period-presentation"
import { usePeriodSelection } from "../period/use-period-selection"
import { BusinessOutcomes } from "../results/business-outcomes"
import { RecordedChangesSection } from "../reporting/recorded-changes-section"
import { DataState, ViewLink } from "../shared/dashboard-components"
import { PageSections } from "../shared/page-sections"
import { FailureGroupsPanel } from "../issues/failure-groups-panel"
import { exploreAnalyticsQueryKey } from "./explore-analytics-query"

export function ExploreAnalyticsContext({
  exploreFrom,
}: {
  exploreFrom: string
}) {
  const { days, workflow, period, report, replace, workflowNames } =
    usePeriodSelection()
  const comparison = `previous ${days} days`
  const scopedWorkflow = workflow
  const changes = report.data
    ? mapRecordedChangeHrefs(
        recordedChanges({
          days,
          workflow: scopedWorkflow,
          startedAfter: period.currentStartedAfter,
          startedBefore: period.currentStartedBefore,
          failureGroups: report.data.failureGroups,
          workflows: report.data.workflows,
          operations: report.data.operations,
        }),
      )
    : []
  const matchingRunsHref = (input: Parameters<typeof failedRunsPath>[0]) =>
    exploreCohortHref(failedRunsPath(input))
  const compatibilityInsights = insightsPath(days, scopedWorkflow)
  const compatibilityIssues = issuesPath(days, scopedWorkflow)

  return (
    <section
      aria-labelledby="explore-analytics-title"
      className="min-w-0 rounded-xl border border-highlight/30 bg-card shadow-sm"
    >
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-highlight/20 bg-highlight/5 px-5 py-4 sm:px-6">
        <div>
          <h2 id="explore-analytics-title" className="text-xs font-medium">
            Reported outcomes and failures
          </h2>
          <p className="mt-1 max-w-2xl text-[11px] leading-5 text-muted-foreground">
            Same period report, business math and failure groups as Insights and
            Attention. Open a cohort below to filter execution evidence without
            leaving Explore.
          </p>
        </div>
        <div className="flex flex-wrap gap-3 text-[10px]">
          <ViewLink href={compatibilityInsights}>Open Insights</ViewLink>
          <ViewLink href={compatibilityIssues}>Open Attention</ViewLink>
        </div>
      </div>
      <div className="grid gap-5 px-5 py-5 sm:px-6">
        <PeriodControls
          days={days}
          workflow={scopedWorkflow}
          workflowNames={workflowNames}
          onChange={replace}
        />
        <p className="text-xs leading-6 text-muted-foreground">
          Runs started{" "}
          {windowLabel({
            startedAfter: period.currentStartedAfter,
            startedBefore: period.currentStartedBefore,
          })}{" "}
          UTC · compared with the previous {days} days.
        </p>
        <DataState
          pending={report.isPending}
          error={report.error}
          retry={() => void report.refetch()}
        />
        {report.data && !report.error ? (
          <PageSections
            label="Explore analytics sections"
            defaultValue="summary"
            queryKey={exploreAnalyticsQueryKey}
            history="replace"
            compact
            sections={[
              {
                value: "summary",
                label: "Summary & changes",
                description:
                  "Compare this period with the previous one, then open a recorded change in the execution evidence list.",
                content: (
                  <>
                    <OverviewMetrics
                      data={report.data}
                      comparison={comparison}
                      title={`Execution summary · last ${days} days`}
                    />
                    <RecordedChangesSection changes={changes} />
                  </>
                ),
              },
              {
                value: "results",
                label: "Reported results",
                description:
                  "Inspect application-reported outcomes for the selected process in this same window.",
                content: scopedWorkflow ? (
                  <BusinessOutcomes
                    key={`${scopedWorkflow}:${period.after}:${period.before}`}
                    workflow={scopedWorkflow}
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
                        Choose a process in the directory or period filter to
                        inspect declared outcomes in this window.
                      </CardDescription>
                    </CardHeader>
                  </Card>
                ),
              },
              {
                value: "failures",
                label: "Failure groups",
                description:
                  "Open matching failed runs in execution evidence, then inspect an individual execution.",
                content: (
                  <FailureGroupsPanel
                    groups={report.data.failureGroups}
                    truncated={report.data.failureGroupsTruncated}
                    startedAfter={period.currentStartedAfter}
                    startedBefore={period.currentStartedBefore}
                    previousStartedAfter={period.previousStartedAfter}
                    previousStartedBefore={period.previousStartedBefore}
                    sourcePath={exploreFrom}
                    scopedWorkflow={Boolean(scopedWorkflow)}
                    matchingRunsHref={matchingRunsHref}
                    exampleRunFrom={exploreFrom}
                  />
                ),
              },
            ]}
          />
        ) : null}
        <p className="flex items-start gap-2 border-t border-border pt-4 text-[10px] leading-5 text-muted-foreground">
          <ArrowUpRight aria-hidden="true" className="mt-0.5 size-3 shrink-0" />
          Volume charts and the full Attention workspace remain on{" "}
          <Link
            href={compatibilityInsights}
            className="text-primary hover:underline"
          >
            Insights
          </Link>{" "}
          and{" "}
          <Link
            href={compatibilityIssues}
            className="text-primary hover:underline"
          >
            Attention
          </Link>
          .
        </p>
      </div>
    </section>
  )
}
