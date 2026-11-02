"use client"

import { Alert, AlertDescription } from "@flowmark/ui"
import { useSearchParams } from "next/navigation"
import {
  DataState,
  PageHeading,
  ViewLink,
} from "../../components/dashboard-components"
import { RunExpectations } from "../expectations/run-expectations"
import { useRunDetail } from "./queries"
import { RunInvestigation } from "./run-investigation"

export function RunDetail({ id }: { id: string }) {
  const params = useSearchParams()
  const { detail, relationships, comparison } = useRunDetail(id, params)
  const { data, isPending, error, refetch } = detail
  return (
    <div className="grid min-w-0 gap-6">
      <PageHeading
        title={data?.[0]?.workflow ?? "Run details"}
        description="One execution · application-reported outcome and evidence."
      >
        <ViewLink href="/runs">All runs</ViewLink>
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
          <RunExpectations id={id} />
          <RunInvestigation
            key={`${id}:${params.get("event") ?? ""}`}
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
