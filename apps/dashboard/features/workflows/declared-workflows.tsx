"use client"

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@flowmark/ui"
import { useInfiniteQuery } from "@tanstack/react-query"
import { Array } from "effect"
import { useTRPC } from "../platform/api-trpc"
import { useProject } from "../projects/project-context"
import { ViewLink } from "../shared/dashboard-components"

/** Discovery also includes configured names without a current execution-directory row. */
export function DeclaredWorkflows({
  recorded,
}: {
  recorded: readonly string[]
}) {
  const trpc = useTRPC()
  const { current } = useProject()
  const discovered = useInfiniteQuery(
    trpc.workflow.discover.infiniteQueryOptions(
      { limit: 25 },
      {
        enabled: Boolean(current),
        getNextPageParam: (page) => page.nextCursor ?? undefined,
      },
    ),
  )
  const names = Array.filter(
    Array.flatMap(discovered.data?.pages ?? [], (page) => page.workflows),
    (workflow) => !Array.contains(recorded, workflow.name),
  )
  return (
    <Card>
      <CardHeader>
        <CardTitle>Other discovered workflow names</CardTitle>
        <CardDescription>
          Configuration and retained workflow records can provide names outside
          the execution directory. A name alone is not evidence that work ran.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid min-w-0 gap-3 text-sm">
        {discovered.isPending && (
          <p role="status">Looking for configured workflows…</p>
        )}
        {discovered.error && (
          <p role="alert">
            Could not load declared workflows.{" "}
            <Button variant="outline" onClick={() => void discovered.refetch()}>
              Retry
            </Button>
          </p>
        )}
        {names.map((workflow) => (
          <ViewLink
            key={workflow.name}
            href={`/runs?workflow=${encodeURIComponent(workflow.name)}&view=configuration`}
          >
            {workflow.name}
          </ViewLink>
        ))}
        {discovered.data && names.length === 0 && (
          <p className="text-muted-foreground">
            No additional declared workflow names in the loaded discovery pages.
          </p>
        )}
        {discovered.hasNextPage && (
          <Button
            variant="outline"
            className="justify-self-start"
            disabled={discovered.isFetchingNextPage}
            onClick={() => void discovered.fetchNextPage()}
          >
            Check more workflows
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
