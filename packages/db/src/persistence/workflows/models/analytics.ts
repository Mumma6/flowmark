import type { StoredRun } from "./runs.js"

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

export type PeriodCounts = Omit<InsightWindow, "startedAfter" | "startedBefore">

export type WorkflowPeriodComparison = {
  readonly name: string
  readonly current: PeriodCounts
  readonly previous: PeriodCounts
}

export type FailureGroup = {
  readonly workflow: string
  readonly code: string
  readonly currentCount: number
  readonly previousCount: number
  readonly countDelta: number
  readonly lastStartedAt: string | null
  readonly runIds: readonly string[]
}

export type PeriodReport = {
  readonly workflow: string | null
  readonly current: InsightWindow
  readonly previous: InsightWindow
  readonly daily: readonly DailyInsight[]
  readonly workflowNames: readonly string[]
  readonly workflows: readonly WorkflowPeriodComparison[]
  readonly failureGroups: readonly FailureGroup[]
  readonly failureGroupsTruncated: boolean
  readonly operations: readonly OperationAttribution[]
}

export type ProjectSnapshot = {
  readonly runs: ReadonlyArray<StoredRun>
  readonly workflows: ReadonlyArray<WorkflowSummary>
  readonly metrics: ProjectMetrics
  readonly daily: ReadonlyArray<DailyInsight>
  readonly operations: ReadonlyArray<OperationInsight>
  readonly failureCodes: ReadonlyArray<FailureCodeInsight>
}
