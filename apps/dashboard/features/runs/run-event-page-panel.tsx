"use client"

import { Button, RunSnapshot, Textarea } from "@flowmark/ui"
import { useInfiniteQuery, useQuery } from "@tanstack/react-query"
import { useTRPC, useTRPCClient } from "../platform/api-trpc"
import { useProject } from "../projects/project-context"
import { CopyButton, DataState } from "../shared/dashboard-components"
import type { RunEvent } from "../platform/api-types"
import { EventTable } from "./run-event-table"
import { buildSuppliedRunSnapshot } from "./supplied-run-snapshot"

export function RunEventPagePanel({
  runId,
  initialEventId,
  page,
}: {
  runId: string
  initialEventId?: string
  page?: { readonly cursor?: string; readonly limit?: number }
}) {
  const trpc = useTRPC()
  const client = useTRPCClient()
  const { current } = useProject()
  const pages = useInfiniteQuery({
    queryKey: [
      ...trpc.run.eventPage.queryKey({ runId }),
      {
        projectId: current?.id ?? null,
        cursor: page?.cursor ?? null,
        limit: page?.limit ?? null,
      },
    ],
    initialPageParam: page?.cursor,
    queryFn: ({ pageParam, signal }) =>
      client.run.eventPage.query(
        {
          runId,
          ...(typeof pageParam === "string" ? { cursor: pageParam } : {}),
          ...(page?.limit ? { limit: page.limit } : {}),
        },
        { signal },
      ),
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
  const firstPage = pages.data?.pages[0]
  const supplied =
    current && summary.isSuccess && pages.isSuccess && firstPage
      ? buildSuppliedRunSnapshot(
          current.id,
          summary.data,
          firstPage,
          Boolean(page?.cursor),
        )
      : null
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
      {summary.isSuccess ? (
        <p className="text-sm text-muted-foreground">
          {summary.data.eventCount} recorded events ·{" "}
          {summary.data.operationCount} operations · {summary.data.errorCount}{" "}
          errors
        </p>
      ) : null}
      {supplied ? (
        <details className="min-w-0 rounded-lg border border-border p-3">
          <summary className="cursor-pointer text-sm font-medium">
            Portable evidence snapshot
          </summary>
          <div className="mt-3">
            <RunSnapshot
              key={`${current?.id}:${runId}:${page?.cursor ?? "initial"}`}
              {...supplied}
              actions={
                <CopyButton
                  label="Copy supplied snapshot JSON"
                  value={JSON.stringify(supplied, null, 2)}
                />
              }
            />
            <details className="mt-3">
              <summary className="cursor-pointer text-sm">
                Supplied JSON
              </summary>
              <Textarea
                aria-label="Supplied snapshot JSON"
                className="mt-2 min-h-32 font-mono text-xs"
                readOnly
                value={JSON.stringify(supplied, null, 2)}
              />
            </details>
          </div>
        </details>
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
