"use client"

import { Badge, Button } from "@flowmark/ui"
import { useInfiniteQuery } from "@tanstack/react-query"
import { useTRPC, useTRPCClient } from "../../../platform/api-trpc"
import { useProject } from "../../../projects/project-context"
import { DataState } from "../../../shared/dashboard-components"
import { formatDuration } from "../../../shared/format"

export function RunOperationsPagePanel({
  runId,
  page,
}: {
  runId: string
  page?: { readonly cursor?: string; readonly limit?: number }
}) {
  const trpc = useTRPC()
  const client = useTRPCClient()
  const { current } = useProject()
  const pages = useInfiniteQuery({
    queryKey: [
      ...trpc.run.operationsPage.queryKey({ runId }),
      {
        projectId: current?.id ?? null,
        cursor: page?.cursor ?? null,
        limit: page?.limit ?? null,
      },
    ],
    initialPageParam: page?.cursor,
    queryFn: ({ pageParam, signal }) =>
      client.run.operationsPage.query(
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
  const operations = pages.data?.pages.flatMap((page) => page.operations) ?? []
  const total = pages.data?.pages[0]?.totalOperations
  return (
    <div className="grid gap-3 p-4">
      <DataState
        pending={pages.isPending}
        error={pages.error}
        retry={() => void pages.refetch()}
      />
      {total !== undefined ? (
        <p className="text-sm text-muted-foreground">
          {total} recorded operation{total === 1 ? "" : "s"}
          {operations.length < total
            ? ` · showing ${operations.length} loaded`
            : ""}
        </p>
      ) : null}
      {operations.length > 0 ? (
        <ol className="grid gap-2" aria-label="Recorded operations">
          {operations.map((operation) => (
            <li
              key={operation.operationId}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm"
            >
              <span className="font-medium">{operation.name}</span>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{operation.status}</Badge>
                {operation.durationMs != null ? (
                  <span className="text-muted-foreground">
                    {formatDuration(operation.durationMs)}
                  </span>
                ) : (
                  <span className="text-muted-foreground">No duration</span>
                )}
              </div>
            </li>
          ))}
        </ol>
      ) : null}
      {pages.hasNextPage ? (
        <Button
          type="button"
          variant="outline"
          disabled={pages.isFetchingNextPage}
          onClick={() => void pages.fetchNextPage()}
        >
          {pages.isFetchingNextPage
            ? "Loading operations…"
            : "Load more operations"}
        </Button>
      ) : null}
      {!pages.isPending && !pages.error && operations.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No operation telemetry recorded for this run.
        </p>
      ) : null}
    </div>
  )
}
