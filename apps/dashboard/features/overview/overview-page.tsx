"use client"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@flowmark/ui"
import {
  DataState,
  PageHeading,
  ViewLink,
} from "../shared/dashboard-components"
import { Refresh } from "../shared/refresh"
import { ExpectationAttention } from "../expectations/expectation-attention"
import { useSnapshot } from "../projects/queries"
import { RunsTable } from "../runs/runs-table"
import {
  AttentionSummary,
  OverviewMetrics,
  WorkflowOverview,
} from "./overview-panels"
import { useIntelligence } from "./queries"

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
        description="Operational health for reported workflow runs. Trends live in Insights. Problems to investigate live in Issues."
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
      <ExpectationAttention />
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
            <AttentionSummary
              failedRuns={
                intelligence.data && !intelligence.error
                  ? intelligence.data.current.failedRuns
                  : null
              }
            />
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
        </>
      )}
    </div>
  )
}
