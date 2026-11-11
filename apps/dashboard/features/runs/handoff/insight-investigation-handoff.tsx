"use client"

import { useMemo, useSyncExternalStore } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import type { RouterInputs, RouterOutputs } from "../../platform/api-types"
import { useAgentAccessDeployment } from "../../platform/runtime-config"
import { useProject } from "../../projects/project-context"
import { connectedInsightCalls } from "../investigation/connected-retrieval"
import { InvestigationContextHandoffCard } from "./investigation-context-handoff-card"
import { buildSafeInsightHandoff } from "./safe-run-context-handoff"

const subscribe = () => () => undefined

function insightHandoffLimitations(
  insights: RouterOutputs["project"]["businessInsights"],
): readonly string[] {
  const lines: string[] = []
  if (!insights.releaseComparison.available) {
    lines.push(
      insights.releaseComparison.reason ??
        "Release comparison unavailable for this selection",
    )
  }
  const current = insights.windows.find((window) => window.scope === "current")
  if (current && current.knownRuns < 5) {
    lines.push(
      "Current window has fewer than five known field observations — no regression conclusion",
    )
  }
  return lines
}

export function InsightInvestigationHandoff({
  workflow,
  selectedRevision,
  validDates,
  field,
  input,
  insights,
}: {
  workflow: string
  selectedRevision: string
  validDates: boolean
  field: { readonly label: string } | undefined
  input: RouterInputs["project"]["businessInsights"]
  insights: RouterOutputs["project"]["businessInsights"]
}) {
  const { current } = useProject()
  const deployment = useAgentAccessDeployment()
  const pathname = usePathname()
  const params = useSearchParams()
  const origin = useSyncExternalStore(
    subscribe,
    () => window.location.origin,
    () => "",
  )
  const sourcePath = `${pathname}${params.size ? `?${params}` : ""}`
  const handoff = useMemo(() => {
    if (!current?.id || !origin || !field) {
      return null
    }
    return buildSafeInsightHandoff(
      {
        projectId: current.id,
        projectName: current.name,
        sourcePath,
        workflow,
        validDates,
        revision: selectedRevision,
        fieldLabel: field.label,
        input,
        releaseComparison: insights.releaseComparison,
        currentWindow: insights.windows.find(
          (window) => window.scope === "current",
        ),
        limitations: insightHandoffLimitations(insights),
      },
      origin,
      deployment.kind === "enabled"
        ? {
            mode: "connected",
            calls: connectedInsightCalls({
              projectId: current.id,
              validDates,
              query: input,
            }),
          }
        : { mode: "manual" },
    )
  }, [
    current,
    field,
    input,
    insights,
    origin,
    selectedRevision,
    sourcePath,
    validDates,
    workflow,
    deployment.kind,
  ])
  if (!handoff) {
    return null
  }
  return (
    <InvestigationContextHandoffCard
      handoff={handoff}
      title="Preview business outcome context"
      description={
        deployment.kind === "enabled"
          ? "Copy the business-insights tool arguments for an agent that already has read access. The text does not grant access."
          : "Copy the exact Insights selection for manual agent investigation. Dimension values and raw payloads stay out of the handoff unless you paste full exports separately."
      }
    />
  )
}
