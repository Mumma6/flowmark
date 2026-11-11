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
import { InvestigationGuide } from "../shared/investigation-guide"
import { PageSections } from "../shared/page-sections"
import { Refresh } from "../shared/refresh"
import { ExpectationAttention } from "../expectations/expectation-attention"
import { useSnapshot } from "../projects/queries"
import { RunsTable } from "../runs/explorer/runs-table"
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
        description="Check reported execution health, see what needs attention, then open a workflow or run to investigate."
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
      <PageSections
        label="Overview sections"
        defaultValue="health"
        sections={[
          {
            value: "health",
            label: "Health & attention",
            description:
              "Start with execution health. Open a workflow to inspect its runs, or follow an attention link to the matching evidence.",
            content: (
              <>
                <ExpectationAttention />
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
                  </>
                )}
              </>
            ),
          },
          {
            value: "activity",
            label: "Latest activity",
            description:
              "These are the five latest executions. Open a run to inspect its reported result and timeline; use Runs for the full searchable history.",
            content: data && data.metrics.totalRuns > 0 && (
              <Card className="overflow-hidden shadow-none">
                <CardHeader className="flex-row flex-wrap items-start justify-between gap-4 space-y-0">
                  <div>
                    <CardTitle className="text-lg">Latest runs</CardTitle>
                    <CardDescription className="mt-2">
                      Results reported by your application
                    </CardDescription>
                  </div>
                  <ViewLink href="/runs">Explore all runs</ViewLink>
                </CardHeader>
                <CardContent className="p-0">
                  <RunsTable runs={data.runs.slice(0, 5)} />
                </CardContent>
              </Card>
            ),
          },
          {
            value: "navigate",
            label: "Where to go next",
            description:
              "Choose the question you want to answer. Each path leads from a project-level view to individual execution evidence.",
            content: <InvestigationGuide />,
          },
        ]}
      />
    </div>
  )
}
