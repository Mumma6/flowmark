import type { WorkflowResult } from "@flowmark/core"

export type RunStatus = "Completed" | "Failed" | "Running"

export type StoredRun = {
  id: string
  externalId: string
  workflow: string
  startedAt: string
  status: RunStatus
  durationMs: number | null
  step: string | null
  result: WorkflowResult | null
  correlationId: string | null
  parentRunId: string | null
}

export type WorkflowSummary = {
  name: string
  runs: number
  successRate: number | null
  medianDurationMs: number
}

export type ProjectMetrics = {
  totalRuns: number
  failedRuns: number
  successRate: number | null
  medianDurationMs: number
}

export type DailyVolume = {
  date: string
  count: number
}

export type RelatedRun = {
  id: string
  externalId: string
  workflow: string
  startedAt: string
  status: RunStatus
  correlationId: string | null
  parentRunId: string | null
}

export type ProjectSnapshot = {
  readonly runs: ReadonlyArray<StoredRun>
  readonly workflows: ReadonlyArray<WorkflowSummary>
  readonly metrics: ProjectMetrics
  readonly daily: ReadonlyArray<DailyVolume>
}

export type RelatedRuns = {
  readonly parentMatches: ReadonlyArray<RelatedRun>
  readonly related: ReadonlyArray<RelatedRun>
}
