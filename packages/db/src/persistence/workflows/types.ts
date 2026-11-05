import type { PeerPopulation } from "@flowmarkdev/core"
import type { RatioSelection } from "@flowmarkdev/core"
import type { ResultSelection } from "@flowmarkdev/core"
import type { WorkflowResult } from "@flowmarkdev/core"
import type { RunTimelineEvent } from "./queries/get-run-timeline.js"

export type RunStatus = "Completed" | "Failed" | "Running"

export type StoredRun = {
  id: string
  externalId: string
  workflow: string
  startedAt: string
  status: RunStatus
  durationMs: number | null
  step: string | null
  outcome?: string | null
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

export type OperationCompareRow = {
  readonly currentOccurrenceCount?: number
  readonly currentOpenCount?: number
  readonly currentFailedCount?: number
  readonly currentMedianOccurrenceDurationMs?: number | null
  readonly currentTotalRecordedDurationMs?: number | null
  readonly name: string
  readonly currentDurationMs: number | null
  readonly currentStatus: "completed" | "failed" | "open" | "absent"
  readonly peerMedianOccurrenceDurationMs?: number | null
  readonly peerMedianTotalRecordedDurationMs?: number | null
  readonly peerOpenRunCount?: number
  readonly peerFailedRunCount?: number
  readonly peerMedianDurationMs: number | null
  readonly peerPresentCount: number
  readonly peerRunIds: ReadonlyArray<string>
}

export type RunComparison = {
  readonly population?: PeerPopulation
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
  readonly retryMatches?: ReadonlyArray<RelatedRun>
  readonly retries?: ReadonlyArray<RelatedRun>
  readonly parentMatches: ReadonlyArray<RelatedRun>
  readonly related: ReadonlyArray<RelatedRun>
}

export type ListedRun = StoredRun & {
  readonly environment: string | null
  readonly release: string | null
  readonly failCode: string | null
}

export type ListRunsQuery = {
  readonly expectationState?: import("@flowmarkdev/core").ExpectationState
  readonly ratioSelection?: RatioSelection
  readonly resultSelection?: ResultSelection
  readonly outcome?: string
  readonly definitionRevision?: string
  readonly terminalOnly?: boolean
  readonly startedBeforeExclusive?: string
  readonly businessKey?: string
  readonly businessValue?: string
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
  readonly attention?: import("@flowmarkdev/core").ExpectationAttention
  readonly runs: ReadonlyArray<ListedRun>
  readonly nextCursor: string | null
  readonly total: number
  readonly limit: number
}

export type ProjectSearchWorkflow = {
  readonly name: string
}

export type ProjectSearchRun = {
  readonly id: string
  readonly externalId: string
  readonly workflow: string
  readonly status: RunStatus
  readonly startedAt: string
  readonly failCode: string | null
}

export type ProjectSearchReference = {
  readonly runId: string
  readonly externalId: string
  readonly workflow: string
  readonly key: string
  readonly value: string
}

export type ProjectSearch = {
  readonly workflows: ReadonlyArray<ProjectSearchWorkflow>
  readonly runs: ReadonlyArray<ProjectSearchRun>
  readonly references: ReadonlyArray<ProjectSearchReference>
}

/** Bounded inspector / agent read: paged run timeline events. */
export interface RunEventPageQuery {
  readonly runId: string
  readonly cursor?: string
  readonly limit?: number
}

export interface RunEventPage {
  readonly runId: string
  readonly events: ReadonlyArray<RunTimelineEvent>
  readonly nextCursor: string | null
  readonly limit: number
  readonly totalEvents: number
}

/** Bounded run header + aggregate counts without loading the full timeline. */
export interface RunInvestigationSummary {
  readonly id: string
  readonly externalId: string
  readonly workflow: string
  readonly status: RunStatus
  readonly startedAt: string
  readonly durationMs: number | null
  readonly step: string | null
  readonly outcome: string | null
  readonly environment: string | null
  readonly release: string | null
  readonly correlationId: string | null
  readonly parentRunId: string | null
  readonly eventCount: number
  readonly operationCount: number
  readonly errorCount: number
  readonly reportCount: number
}

export type RelatedRunRelationship =
  "parent" | "correlated" | "retryOf" | "retry"

export interface RelatedRunLink {
  readonly id: string
  readonly externalId: string
  readonly workflow: string
  readonly startedAt: string
  readonly status: RunStatus
  readonly correlationId: string | null
  readonly parentRunId: string | null
  readonly relationship: RelatedRunRelationship
}

export interface RelatedRunsPageQuery {
  readonly runId: string
  readonly cursor?: string
  readonly limit?: number
}

export interface RelatedRunsPage {
  readonly runId: string
  readonly items: ReadonlyArray<RelatedRunLink>
  readonly nextCursor: string | null
  readonly limit: number
  readonly totalLinks: number
}

export interface RunExpectationsPageQuery {
  readonly runId: string
  readonly cursor?: string
  readonly limit?: number
}

export interface RunExpectationsPage {
  readonly runId: string
  readonly asOf: string
  readonly expectations: ReadonlyArray<
    import("@flowmarkdev/core").ExpectationRecord
  >
  readonly unmatched: ReadonlyArray<
    import("@flowmarkdev/core").ExpectationRecord
  >
  readonly nextCursor: string | null
  readonly limit: number
  readonly totalRecords: number
  readonly unavailableCount: number
}

export interface RunOperationOccurrence {
  readonly operationId: string
  readonly name: string
  readonly startedAt: string
  readonly durationMs: number | null
  readonly status: "completed" | "failed" | "open"
}

export interface RunOperationsPageQuery {
  readonly runId: string
  readonly cursor?: string
  readonly limit?: number
}

export interface RunOperationsPage {
  readonly runId: string
  readonly operations: ReadonlyArray<RunOperationOccurrence>
  readonly nextCursor: string | null
  readonly limit: number
  readonly totalOperations: number
}
