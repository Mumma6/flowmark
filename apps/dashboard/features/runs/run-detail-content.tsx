"use client"

import { Alert, AlertDescription } from "@flowmark/ui"
import { useSearchParams } from "next/navigation"
import { DataState } from "../shared/dashboard-components"
import type { useRunDetail } from "./queries"
import { RunInvestigation } from "./run-investigation"

export function RunDetailContent({
  id,
  queries,
  contextual = false,
}: {
  id: string
  queries: ReturnType<typeof useRunDetail>
  contextual?: boolean
}) {
  const params = useSearchParams()
  const { detail, comparison } = queries
  return (
    <>
      <DataState
        pending={detail.isPending}
        error={detail.error}
        retry={() => void detail.refetch()}
      />
      {!detail.error && detail.data?.length === 0 ? (
        <Alert>
          <AlertDescription>No run found in this project.</AlertDescription>
        </Alert>
      ) : null}
      {!detail.error && detail.data && detail.data.length > 0 ? (
        <RunInvestigation
          key={`${id}:${params.get("event") ?? ""}`}
          runId={id}
          events={detail.data}
          contextual={contextual}
          comparison={comparison.data}
          comparisonLoading={comparison.isPending}
          comparisonError={comparison.error?.message}
        />
      ) : null}
    </>
  )
}
