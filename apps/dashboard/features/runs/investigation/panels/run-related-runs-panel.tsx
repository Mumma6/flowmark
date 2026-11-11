"use client"

import type { AppRouter } from "@flowmark/server/trpc"
import { Alert, AlertDescription, Button } from "@flowmark/ui"
import type { inferRouterOutputs } from "@trpc/server"
import { useInfiniteQuery } from "@tanstack/react-query"
import { useTRPC, useTRPCClient } from "../../../platform/api-trpc"
import { useProject } from "../../../projects/project-context"
import { DataState } from "../../../shared/dashboard-components"
import { RelatedRunsTable } from "./related-runs-table"

type RelatedRunsPage = inferRouterOutputs<AppRouter>["run"]["relatedPage"]
type RelatedRunLink = RelatedRunsPage["items"][number]

function groupLinks(items: readonly RelatedRunLink[]) {
  return {
    retryMatches: items.filter((row) => row.relationship === "retryOf"),
    retries: items.filter((row) => row.relationship === "retry"),
    parentMatches: items.filter((row) => row.relationship === "parent"),
    related: items.filter((row) => row.relationship === "correlated"),
  }
}

export function RunRelatedRunsPanel({
  runId,
  source,
  replace,
  retryOf,
  correlationId,
  parentRunId,
  page,
}: {
  runId: string
  source?: string
  replace?: boolean
  retryOf?: { workflow: string; runId: string } | null
  correlationId?: string | null
  parentRunId?: string | null
  page?: { readonly cursor?: string; readonly limit?: number }
}) {
  const trpc = useTRPC()
  const client = useTRPCClient()
  const { current } = useProject()
  const pages = useInfiniteQuery({
    queryKey: [
      ...trpc.run.relatedPage.queryKey({ runId }),
      {
        projectId: current?.id ?? null,
        cursor: page?.cursor ?? null,
        limit: page?.limit ?? null,
      },
    ],
    initialPageParam: page?.cursor,
    queryFn: ({ pageParam, signal }) =>
      client.run.relatedPage.query(
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
  const items = pages.data?.pages.flatMap((page) => page.items) ?? []
  const total = pages.data?.pages[0]?.totalLinks
  const grouped = groupLinks(items)
  return (
    <div className="grid gap-4">
      <DataState
        pending={pages.isPending}
        error={pages.error}
        retry={() => void pages.refetch()}
      />
      {pages.error ? (
        <Alert variant="destructive">
          <AlertDescription>
            Could not load linked runs: {pages.error.message}
          </AlertDescription>
        </Alert>
      ) : null}
      {total !== undefined ? (
        <p className="text-sm text-muted-foreground">
          {total} explicit link{total === 1 ? "" : "s"} in this project
          {items.length < total
            ? ` · showing ${items.length} loaded`
            : total > 0
              ? " · all loaded"
              : ""}
        </p>
      ) : null}
      {retryOf ? (
        <p className="text-sm">
          Retry of{" "}
          <code>
            {retryOf.workflow} / {retryOf.runId}
          </code>
          . This execution has its own status and reported result; totals across
          executions are not deduplicated items.
        </p>
      ) : null}
      <RelatedRunsTable
        source={source}
        replace={replace}
        title="Previous execution (explicit retry link)"
        runs={grouped.retryMatches}
        empty={
          retryOf
            ? "Referenced execution not recorded or not accessible in this project."
            : "No retry-of reference supplied."
        }
      />
      <RelatedRunsTable
        source={source}
        replace={replace}
        title="Later executions retrying this run"
        runs={grouped.retries}
        empty="No later retry links recorded in this project."
      />
      <RelatedRunsTable
        source={source}
        replace={replace}
        title="Parent matches"
        runs={grouped.parentMatches}
        empty={
          parentRunId
            ? "No matching parent recorded in this project."
            : "No parent link supplied."
        }
      />
      <RelatedRunsTable
        source={source}
        replace={replace}
        title="Shared correlation"
        runs={grouped.related}
        empty={
          correlationId
            ? "No other matching runs recorded."
            : "No correlation ID supplied."
        }
      />
      {pages.hasNextPage ? (
        <Button
          type="button"
          variant="outline"
          disabled={pages.isFetchingNextPage}
          onClick={() => void pages.fetchNextPage()}
        >
          {pages.isFetchingNextPage ? "Loading links…" : "Load more links"}
        </Button>
      ) : null}
    </div>
  )
}
