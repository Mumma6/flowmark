"use client"

import {
  DataState,
  PageHeading,
  ViewLink,
} from "../shared/dashboard-components"
import { PageSections } from "../shared/page-sections"
import { Refresh } from "../shared/refresh"
import { useSnapshot } from "../projects/queries"
import { WorkflowDirectory } from "./workflow-directory"
import { DeclaredWorkflows } from "./declared-workflows"

export function ProjectWorkflows() {
  const { data, isPending, error, isFetching, refetch } = useSnapshot()
  return (
    <div className="grid min-w-0 gap-6">
      <PageHeading
        title="Workflows"
        description="Choose the process you want to inspect. Each workflow brings together its execution history, reported results and diagnostic evidence."
      >
        <Refresh fetching={isFetching} onClick={() => void refetch()} />
      </PageHeading>
      <DataState
        pending={isPending}
        error={error}
        retry={() => void refetch()}
      />
      <PageSections
        label="Workflow directory sections"
        defaultValue="directory"
        sections={[
          {
            value: "directory",
            label: "Workflow directory",
            description:
              "Search by workflow name or sort by volume. Open a workflow to find its individual runs, reported results and configuration.",
            keepMounted: true,
            content: data && (
              <div className="grid min-w-0 gap-5">
                <WorkflowDirectory workflows={data.workflows} />
                <DeclaredWorkflows
                  recorded={data.workflows.map((workflow) => workflow.name)}
                />
              </div>
            ),
          },
          {
            value: "navigate",
            label: "What to look for",
            description:
              "Use the directory to choose a process. Use Insights for a period comparison, or Issues to start from evidence that needs attention.",
            content: (
              <div className="grid gap-5 md:grid-cols-3">
                <section className="rounded-xl border border-border bg-card p-5">
                  <h2 className="text-lg font-semibold">Inspect one process</h2>
                  <p className="mt-3 text-base leading-7 text-muted-foreground">
                    A workflow is a named process; a run is one execution. Open
                    a workflow, choose Runs or Reported results, then open an
                    execution for its evidence.
                  </p>
                </section>
                <section className="rounded-xl border border-border bg-card p-5">
                  <h2 className="text-lg font-semibold">Compare performance</h2>
                  <p className="mt-3 text-base leading-7 text-muted-foreground">
                    The directory summarizes all recorded runs. To answer what
                    changed recently, compare two periods in Insights.
                    Completion covers finished runs; p95 is the duration at the
                    95th percentile.
                  </p>
                  <ViewLink href="/insights">Compare in Insights</ViewLink>
                </section>
                <section className="rounded-xl border border-border bg-card p-5">
                  <h2 className="text-lg font-semibold">
                    Find a problem to investigate
                  </h2>
                  <p className="mt-3 text-base leading-7 text-muted-foreground">
                    Technical completion can coexist with rejected work or
                    missing confirmations. Check reported results and
                    confirmations separately, or start from a failure group.
                  </p>
                  <ViewLink href="/issues">Investigate in Issues</ViewLink>
                </section>
              </div>
            ),
          },
        ]}
      />
    </div>
  )
}
