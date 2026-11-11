import type { StoredRun } from "./runs.js"

export interface WorkflowSummary {
  readonly name: string
  readonly runs: number
  readonly successRate: number | null
  readonly medianDurationMs: number
  readonly p95DurationMs: number
}

export interface DailyInsight {
  readonly date: string
  readonly count: number
  readonly completed: number
  readonly failed: number
  readonly successRate: number | null
  readonly medianDurationMs: number | null
  readonly p95DurationMs: number | null
}

export interface OperationInsight {
  readonly name: string
  readonly workflow: string
  readonly count: number
  readonly failed: number
  readonly medianDurationMs: number
  readonly p95DurationMs: number
  readonly totalDurationMs: number
}

export interface FailureCodeInsight {
  readonly code: string
  readonly workflow: string
  readonly count: number
}

export interface ProjectSnapshot {
  readonly runs: ReadonlyArray<StoredRun>
  readonly workflows: ReadonlyArray<WorkflowSummary>
  readonly metrics: {
    readonly totalRuns: number
    readonly failedRuns: number
    readonly successRate: number | null
    readonly medianDurationMs: number
    readonly p95DurationMs: number
  }
  readonly daily: ReadonlyArray<DailyInsight>
  readonly operations: ReadonlyArray<OperationInsight>
  readonly failureCodes: ReadonlyArray<FailureCodeInsight>
}

export interface InsightWindow {
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

export interface OperationAttribution {
  readonly name: string
  readonly currentRunCount: number
  readonly previousRunCount: number
  readonly currentMedianDurationMs: number | null
  readonly previousMedianDurationMs: number | null
  readonly durationDeltaMs: number | null
  readonly currentRunIds: ReadonlyArray<string>
  readonly previousRunIds: ReadonlyArray<string>
}

export interface FailureCodeAttribution {
  readonly code: string
  readonly currentCount: number
  readonly previousCount: number
  readonly countDelta: number
  readonly currentRunIds: ReadonlyArray<string>
  readonly previousRunIds: ReadonlyArray<string>
}

export interface WorkflowIntelligence {
  readonly workflow: string | null
  readonly current: InsightWindow
  readonly previous: InsightWindow
  readonly operations: ReadonlyArray<OperationAttribution>
  readonly failureCodes: ReadonlyArray<FailureCodeAttribution>
}

export interface IntelligenceQuery {
  readonly workflow?: string
  readonly currentStartedAfter: string
  readonly currentStartedBefore: string
  readonly previousStartedAfter: string
  readonly previousStartedBefore: string
}

export type PeriodCounts = Omit<InsightWindow, "startedAfter" | "startedBefore">

export interface WorkflowPeriodComparison {
  readonly name: string
  readonly current: PeriodCounts
  readonly previous: PeriodCounts
}

export interface FailureGroup {
  readonly workflow: string
  readonly code: string
  readonly currentCount: number
  readonly previousCount: number
  readonly countDelta: number
  readonly lastStartedAt: string | null
  readonly runIds: readonly string[]
}

export interface PeriodReport {
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
