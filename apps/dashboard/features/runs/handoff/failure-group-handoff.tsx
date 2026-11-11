"use client"

import { useMemo, useSyncExternalStore } from "react"
import { useAgentAccessDeployment } from "../../platform/runtime-config"
import { useProject } from "../../projects/project-context"
import { connectedFailureCalls } from "../investigation/connected-retrieval"
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
  const deployment = useAgentAccessDeployment()
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
      deployment.kind === "enabled"
        ? {
            mode: "connected",
            calls: connectedFailureCalls({
              projectId: current.id,
              workflow,
              code,
              currentStartedAfter,
              currentStartedBefore,
              previousStartedAfter,
              previousStartedBefore,
            }),
          }
        : { mode: "manual" },
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
    deployment.kind,
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
