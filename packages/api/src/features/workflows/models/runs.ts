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
  readonly boundedPreviewOmissions?: ReadonlyArray<string>
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

export interface RelatedRunLink extends RelatedRun {
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

/** Ordered evidence for application-owned comparison calculations. */
export interface OperationEvidenceEvent {
  readonly type: string
  readonly operationId: string | null
  readonly operationName: string | null
  readonly durationMs: number | null
  readonly timestamp: string
}
export interface RunComparisonEvidence {
  readonly population?: PeerPopulation
  readonly current: StoredRun | null
  readonly peers: readonly StoredRun[]
  readonly currentOperations: readonly OperationEvidenceEvent[]
  readonly peerOperations: readonly {
    readonly runId: string
    readonly events: readonly OperationEvidenceEvent[]
  }[]
}

export interface ReferenceJourneyEvidence {
  readonly page: import("@flowmarkdev/core").ReferenceJourneyPage
  readonly graph: {
    readonly nodes: readonly string[]
    readonly edges: readonly import("@flowmarkdev/core").JourneyEdge[]
  }
}
