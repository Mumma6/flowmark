"use client"

import { formatTimestamp } from "./dashboard-data"
import { windowLabel } from "./overview-presentation"

import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import { Alert, AlertDescription } from "@flowmark/ui"
import { useTRPC } from "../lib/trpc"
import { useProject } from "./project-context"

export function ExpectationAttention({
  workflow,
  startedAfter,
  startedBeforeExclusive,
}: {
  workflow?: string
  startedAfter?: string
  startedBeforeExclusive?: string
}) {
  const trpc = useTRPC(),
    { current } = useProject()
  const fallback = useMemo(() => {
    const end = new Date()
    return {
      startedAfter: new Date(end.getTime() - 30 * 86400000).toISOString(),
      startedBefore: end.toISOString(),
    }
  }, [])
  const bounded = Boolean(startedAfter && startedBeforeExclusive)
  const window = bounded
    ? {
        startedAfter: startedAfter ?? fallback.startedAfter,
        startedBeforeExclusive,
      }
    : fallback
  const query = useQuery({
    ...trpc.run.list.queryOptions({ ...window, workflow, limit: 1 }),
    enabled: Boolean(current),
    refetchInterval: 10000,
  })
  if (query.error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Could not load expectation attention: {query.error.message}
        </AlertDescription>
      </Alert>
    )
  }
  if (query.isPending) {
    return (
      <p role="status" className="text-sm text-muted-foreground">
        Loading expected confirmations…
      </p>
    )
  }
  const attention = query.data?.attention
  if (!attention) {
    return null
  }
  const params = new URLSearchParams({
    expectationState: "overdue",
    startedAfterExact: window.startedAfter,
  })
  if ("startedBeforeExclusive" in window && window.startedBeforeExclusive) {
    params.set("startedBeforeExclusive", window.startedBeforeExclusive)
  } else if ("startedBefore" in window) {
    params.set("startedBeforeExact", window.startedBefore)
  }
  if (workflow) {
    params.set("workflow", workflow)
  }
  return (
    <Alert>
      <AlertDescription>
        <Link
          className="font-medium text-primary underline"
          href={`/runs?${params}`}
        >
          {attention.overdueRuns} of {attention.totalRuns} runs have overdue
          expectations
        </Link>
        <span className="block text-xs text-muted-foreground">
          {attention.overdueExpectations} overdue expectations ·{" "}
          {bounded && startedBeforeExclusive
            ? `runs started ${windowLabel({
                startedAfter: window.startedAfter,
                startedBefore: startedBeforeExclusive,
              })} UTC`
            : "runs started in this 30-day cohort"}{" "}
          · retained observed evidence, separate from technical failures ·
          observed {formatTimestamp(attention.asOf)} UTC
        </span>
      </AlertDescription>
    </Alert>
  )
}
