"use client"

import { DataState, PageHeading } from "../shared/dashboard-components"
import { Refresh } from "../shared/refresh"
import { useSnapshot } from "../projects/queries"
import { WorkflowDirectory } from "./workflow-directory"

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
