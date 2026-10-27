import type { WorkflowResult } from "@flowmarkdev/core"

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

export type InsightWindow = {
  readonly startedAfter: string
  readonly startedBefore: string
  readonly totalRuns: number
  readonly finishedRuns: number
  readonly completedRuns: number
  readonly failedRuns: number
  readonly successRate: number | null
  readonly medianDurationMs: number | null
  readonly p95DurationMs: number | null
}

export type OperationAttribution = {
  readonly name: string
  readonly currentRunCount: number
  readonly previousRunCount: number
  readonly currentMedianDurationMs: number | null
  readonly previousMedianDurationMs: number | null
  readonly durationDeltaMs: number | null
  readonly currentRunIds: ReadonlyArray<string>
  readonly previousRunIds: ReadonlyArray<string>
}

export type FailureCodeAttribution = {
  readonly code: string
  readonly currentCount: number
  readonly previousCount: number
  readonly countDelta: number
  readonly currentRunIds: ReadonlyArray<string>
  readonly previousRunIds: ReadonlyArray<string>
}

export type WorkflowIntelligence = {
  readonly workflow: string | null
  readonly current: InsightWindow
  readonly previous: InsightWindow
  readonly operations: ReadonlyArray<OperationAttribution>
  readonly failureCodes: ReadonlyArray<FailureCodeAttribution>
}

export type IntelligenceQuery = {
  readonly workflow?: string
  readonly currentStartedAfter: string
  readonly currentStartedBefore: string
  readonly previousStartedAfter: string
  readonly previousStartedBefore: string
}

export type OperationCompareRow = {
  readonly name: string
  readonly currentDurationMs: number | null
  readonly currentStatus: "completed" | "failed" | "open" | "absent"
  readonly peerMedianDurationMs: number | null
  readonly peerPresentCount: number
  readonly peerRunIds: ReadonlyArray<string>
}

export type RunComparison = {
  readonly current: StoredRun | null
  readonly peers: ReadonlyArray<StoredRun>
  readonly peerSuccessRate: number | null
  readonly peerMedianDurationMs: number | null
  readonly peerP95DurationMs: number | null
  readonly operations: ReadonlyArray<OperationCompareRow>
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

export type ListedRun = StoredRun & {
  readonly environment: string | null
  readonly release: string | null
  readonly failCode: string | null
}

export type ListRunsQuery = {
  readonly workflow?: string
  readonly status?: RunStatus
  readonly search?: string
  readonly externalId?: string
  readonly failCode?: string
  readonly environment?: string
  readonly release?: string
  readonly correlationId?: string
  readonly parentRunId?: string
  readonly namespace?: "browser" | "application"
  readonly startedAfter?: string
  readonly startedBefore?: string
  readonly cursor?: string
  readonly limit?: number
}

export type ListedRunsPage = {
  readonly runs: ReadonlyArray<ListedRun>
  readonly nextCursor: string | null
  readonly total: number
  readonly limit: number
}
