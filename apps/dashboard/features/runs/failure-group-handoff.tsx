"use client"

import { useMemo, useSyncExternalStore } from "react"
import { useProject } from "../projects/project-context"
import { InvestigationContextHandoffCard } from "./investigation-context-handoff-card"
import { buildSafeFailureGroupHandoff } from "./safe-run-context-handoff"

const subscribe = () => () => undefined

export function FailureGroupHandoff({
  sourcePath,
  currentStartedAfter,
  currentStartedBefore,
  previousStartedAfter,
  previousStartedBefore,
  workflow,
  code,
  currentCount,
  previousCount,
  countDelta,
  matchingRunsPath,
  truncated,
}: {
  sourcePath: string
  currentStartedAfter: string
  currentStartedBefore: string
  previousStartedAfter: string
  previousStartedBefore: string
  workflow: string
  code: string
  currentCount: number
  previousCount: number
  countDelta: number
  matchingRunsPath: string
  truncated: boolean
}) {
  const { current } = useProject()
  const origin = useSyncExternalStore(
    subscribe,
    () => window.location.origin,
    () => "",
  )
  const handoff = useMemo(() => {
    if (!current?.id || !origin) {
      return null
    }
    return buildSafeFailureGroupHandoff(
      {
        projectId: current.id,
        projectName: current.name,
        sourcePath,
        currentStartedAfter,
        currentStartedBefore,
        previousStartedAfter,
        previousStartedBefore,
        workflow,
        code,
        currentCount,
        previousCount,
        countDelta,
        matchingRunsPath,
        truncated,
      },
      origin,
    )
  }, [
    code,
    countDelta,
    current,
    currentCount,
    currentStartedAfter,
    currentStartedBefore,
    matchingRunsPath,
    origin,
    previousCount,
    previousStartedAfter,
    previousStartedBefore,
    sourcePath,
    truncated,
    workflow,
  ])
  if (!handoff) {
    return null
  }
  return (
    <details className="mt-2 min-w-[12rem]">
      <summary className="cursor-pointer text-xs font-medium text-primary">
        Agent handoff
      </summary>
      <div className="mt-3">
        <InvestigationContextHandoffCard
          handoff={handoff}
          compact
          title="Failure group context"
        />
      </div>
    </details>
  )
}
