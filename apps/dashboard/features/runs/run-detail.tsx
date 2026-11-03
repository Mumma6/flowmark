"use client"

import { Alert, AlertDescription } from "@flowmark/ui"
import { useSearchParams } from "next/navigation"
import {
  DataState,
  PageHeading,
  ViewLink,
} from "../shared/dashboard-components"
import { useRunDetail } from "./queries"
import { RunInvestigation } from "./run-investigation"
import { investigationReturn } from "./investigation-navigation"

export function RunDetail({ id }: { id: string }) {
  const params = useSearchParams()
  const back = investigationReturn(params.get("from"))
  const { detail, relationships, comparison } = useRunDetail(id, params)
  const { data, isPending, error, refetch } = detail
  return (
    <div className="grid min-w-0 gap-6">
      <PageHeading
        title={data?.[0]?.workflow ?? "Run details"}
        description="Follow one execution from its reported outcome to the supporting events. Take the relevant evidence back to your application when you are ready to act."
      >
        <ViewLink href={back.href}>{back.label}</ViewLink>
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
        <>
          <RunInvestigation
            key={`${id}:${params.get("event") ?? ""}`}
            runId={id}
            events={data}
            relationships={relationships.data}
            relationshipsLoading={relationships.isPending}
            relationshipsError={relationships.error?.message}
            comparison={comparison.data}
            comparisonLoading={comparison.isPending}
            comparisonError={comparison.error?.message}
          />
        </>
      )}
    </div>
  )
}
