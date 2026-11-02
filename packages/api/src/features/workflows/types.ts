import type {
  ExpectationAttention,
  ExpectationEvent,
  ExpectationState,
  PeerPopulation,
  RatioSelection,
  ResultSelection,
  WorkflowAttempt,
  WorkflowError,
  WorkflowFailure,
  WorkflowProperties,
  WorkflowResult,
  WorkflowRetryReference,
} from "@flowmarkdev/core"

export type RunStatus = "Completed" | "Failed" | "Running"

export interface StoredRun {
  readonly id: string
  readonly externalId: string
  readonly workflow: string
  readonly startedAt: string
  readonly status: RunStatus
  readonly durationMs: number | null
  readonly step: string | null
  readonly outcome?: string | null
  readonly result: WorkflowResult | null
  readonly correlationId: string | null
  readonly parentRunId: string | null
}

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

export interface OperationCompareRow {
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

export interface RunComparison {
  readonly population?: PeerPopulation
  readonly current: StoredRun | null
  readonly peers: ReadonlyArray<StoredRun>
  readonly peerSuccessRate: number | null
  readonly peerMedianDurationMs: number | null
  readonly peerP95DurationMs: number | null
  readonly operations: ReadonlyArray<OperationCompareRow>
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

export interface RunTimelineEvent {
  readonly expectation?: ExpectationEvent | null
  readonly expectationObservedAt?: string | null
  readonly attempt?: WorkflowAttempt | null
  readonly retryOf?: WorkflowRetryReference | null
  readonly id: string
  readonly type: string
  readonly step: string | null
  readonly operationId: string | null
  readonly operationName: string | null
  readonly durationMs: number | null
  readonly completed: number | null
  readonly total: number | null
  readonly unit: string | null
  readonly reason: string | null
  readonly properties: WorkflowProperties | null
  readonly error: WorkflowError | WorkflowFailure | null
  readonly outcome?: string | null
  readonly result: WorkflowResult | null
  readonly timestamp: string
  readonly isLatestReport?: boolean
  readonly receiptOrder?: number
  readonly receivedAt: string
  readonly workflow: string
  readonly externalId: string
  readonly environment: string | null
  readonly release: string | null
  readonly correlationId: string | null
  readonly parentRunId: string | null
}

export type RelatedRun = Omit<
  StoredRun,
  "durationMs" | "step" | "result" | "outcome"
>

export interface RelatedRuns {
  readonly retryMatches?: ReadonlyArray<RelatedRun>
  readonly retries?: ReadonlyArray<RelatedRun>
  readonly parentMatches: ReadonlyArray<RelatedRun>
  readonly related: ReadonlyArray<RelatedRun>
}

export interface ListedRun extends StoredRun {
  readonly environment: string | null
  readonly release: string | null
  readonly failCode: string | null
}

export interface ListRunsQuery {
  readonly expectationState?: ExpectationState
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

export interface ListedRunsPage {
  readonly attention?: ExpectationAttention
  readonly runs: ReadonlyArray<ListedRun>
  readonly nextCursor: string | null
  readonly total: number
  readonly limit: number
}

export interface ProjectSearchWorkflow {
  readonly name: string
}

export interface ProjectSearchRun {
  readonly id: string
  readonly externalId: string
  readonly workflow: string
  readonly status: RunStatus
  readonly startedAt: string
  readonly failCode: string | null
}

export interface ProjectSearchReference {
  readonly runId: string
  readonly externalId: string
  readonly workflow: string
  readonly key: string
  readonly value: string
}

export interface ProjectSearch {
  readonly workflows: ReadonlyArray<ProjectSearchWorkflow>
  readonly runs: ReadonlyArray<ProjectSearchRun>
  readonly references: ReadonlyArray<ProjectSearchReference>
}
