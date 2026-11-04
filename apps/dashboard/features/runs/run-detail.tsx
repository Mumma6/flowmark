"use client"

import { useSearchParams } from "next/navigation"
import { PageHeading, ViewLink } from "../shared/dashboard-components"
import { useRunDetail } from "./queries"
import { RunDetailContent } from "./run-detail-content"
import { investigationReturn } from "./investigation-navigation"

export function RunDetail({ id }: { id: string }) {
  const params = useSearchParams()
  const back = investigationReturn(params.get("from"))
  const queries = useRunDetail(id, params)
  return (
    <div className="grid min-w-0 gap-6">
      <PageHeading
        title={queries.detail.data?.[0]?.workflow ?? "Run details"}
        description="Follow one execution from its reported outcome to the supporting events. Take the relevant evidence back to your application when you are ready to act."
      >
        <ViewLink href={back.href}>{back.label}</ViewLink>
      </PageHeading>
      <RunDetailContent id={id} queries={queries} />
    </div>
  )
}
