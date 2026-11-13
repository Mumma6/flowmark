import type { PeerPopulation } from "@flowmarkdev/core"
import type { RatioSelection } from "@flowmarkdev/core"
import type { ResultSelection } from "@flowmarkdev/core"
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
  outcome?: string | null
  result: WorkflowResult | null
  correlationId: string | null
  parentRunId: string | null
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

export type RunTimelineEvent = {
  expectation?: import("@flowmarkdev/core").ExpectationEvent | null
  expectationObservedAt?: string | null
  id: string
  type: string
  step: string | null
  operationId: string | null
  attempt?: import("@flowmarkdev/core").WorkflowAttempt | null
  retryOf?: import("@flowmarkdev/core").WorkflowRetryReference | null
  operationName: string | null
  durationMs: number | null
  completed: number | null
  total: number | null
  unit: string | null
  reason: string | null
  properties: import("@flowmarkdev/core").WorkflowProperties | null
  error:
    | import("@flowmarkdev/core").WorkflowError
    | import("@flowmarkdev/core").WorkflowFailure
    | null
  outcome?: string | null
  result: import("@flowmarkdev/core").WorkflowResult | null
  timestamp: string
  isLatestReport?: boolean
  receiptOrder?: number
  receivedAt: string
  workflow: string
  externalId: string
  environment: string | null
  release: string | null
  correlationId: string | null
  parentRunId: string | null
  readonly boundedPreviewOmissions?: ReadonlyArray<string>
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
