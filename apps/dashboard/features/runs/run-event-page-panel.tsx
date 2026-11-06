"use client"

import { Button } from "@flowmark/ui"
import { useInfiniteQuery, useQuery } from "@tanstack/react-query"
import { useTRPC, useTRPCClient } from "../platform/api-trpc"
import { useProject } from "../projects/project-context"
import { DataState } from "../shared/dashboard-components"
import type { RunEvent } from "../platform/api-types"
import { EventTable } from "./run-event-table"

export function RunEventPagePanel({
  runId,
  initialEventId,
}: {
  runId: string
  initialEventId?: string
}) {
  const trpc = useTRPC()
  const client = useTRPCClient()
  const { current } = useProject()
  const pages = useInfiniteQuery({
    queryKey: [
      ...trpc.run.eventPage.queryKey({ runId }),
      { projectId: current?.id ?? null },
    ],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) =>
      client.run.eventPage.query({ runId, cursor: pageParam }, { signal }),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    enabled: Boolean(current),
  })
  const summary = useQuery({
    queryKey: [
      ...trpc.run.investigationSummary.queryKey({ id: runId }),
      { projectId: current?.id ?? null },
    ],
    queryFn: ({ signal }) =>
      client.run.investigationSummary.query({ id: runId }, { signal }),
    enabled: Boolean(current),
  })
  const events = pages.data?.pages.flatMap((page) => page.events) ?? []
  const total = pages.data?.pages[0]?.totalEvents
  return (
    <div className="grid gap-3">
      <DataState
        pending={summary.isPending || pages.isPending}
        error={summary.error ?? pages.error}
        retry={() => {
          void summary.refetch()
          void pages.refetch()
        }}
      />
      {summary.data ? (
        <p className="text-sm text-muted-foreground">
          {summary.data.eventCount} recorded events
          {summary.data.operationCount > 0
            ? ` · ${summary.data.operationCount} operations`
            : ""}
          {summary.data.errorCount > 0
            ? ` · ${summary.data.errorCount} errors`
            : ""}
        </p>
      ) : null}
      {events.length > 0 ? (
        <>
          <EventTable
            events={events as readonly RunEvent[]}
            initialEventId={initialEventId}
          />
          {pages.hasNextPage ? (
            <Button
              type="button"
              variant="outline"
              disabled={pages.isFetchingNextPage}
              onClick={() => void pages.fetchNextPage()}
            >
              {pages.isFetchingNextPage
                ? "Loading events…"
                : "Load more events"}
            </Button>
          ) : total !== undefined && events.length >= total ? (
            <p className="text-sm text-muted-foreground">
              All {total} events loaded.
            </p>
          ) : null}
        </>
      ) : null}
      {!pages.isPending && !pages.error && events.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No events recorded for this run.
        </p>
      ) : null}
    </div>
  )
}
