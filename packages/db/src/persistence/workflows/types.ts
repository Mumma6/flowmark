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
  p95DurationMs: number
}

export type ProjectMetrics = {
  totalRuns: number
  failedRuns: number
  successRate: number | null
  medianDurationMs: number
  p95DurationMs: number
}

export type DailyInsight = {
  date: string
  count: number
  completed: number
  failed: number
  successRate: number | null
  medianDurationMs: number | null
  p95DurationMs: number | null
}

export type OperationInsight = {
  name: string
  workflow: string
  count: number
  failed: number
  medianDurationMs: number
  p95DurationMs: number
  totalDurationMs: number
}

export type FailureCodeInsight = {
  code: string
  workflow: string
  count: number
}

export type RunComparison = {
  readonly current: StoredRun | null
  readonly peers: ReadonlyArray<StoredRun>
  readonly peerSuccessRate: number | null
  readonly peerMedianDurationMs: number | null
  readonly peerP95DurationMs: number | null
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
  readonly daily: ReadonlyArray<DailyInsight>
  readonly operations: ReadonlyArray<OperationInsight>
  readonly failureCodes: ReadonlyArray<FailureCodeInsight>
}

export type RelatedRuns = {
  readonly parentMatches: ReadonlyArray<RelatedRun>
  readonly related: ReadonlyArray<RelatedRun>
}
