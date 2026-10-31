import { Context, type Effect } from "effect"
import type {
  WorkflowError,
  WorkflowFailure,
  WorkflowEvent,
  AppendDisposition,
  WorkflowProperties,
  WorkflowResult,
} from "@flowmarkdev/core"
import type { PersistenceError, RunNotFound } from "../../../errors.js"

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
  readonly name: string
  readonly currentDurationMs: number | null
  readonly currentStatus: "completed" | "failed" | "open" | "absent"
  readonly peerMedianDurationMs: number | null
  readonly peerPresentCount: number
  readonly peerRunIds: ReadonlyArray<string>
}

export interface RunComparison {
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

export interface RunTimelineEvent {
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

export type RelatedRun = Omit<StoredRun, "durationMs" | "step" | "result">

export interface RelatedRuns {
  readonly parentMatches: ReadonlyArray<RelatedRun>
  readonly related: ReadonlyArray<RelatedRun>
}

export interface ListedRun extends StoredRun {
  readonly environment: string | null
  readonly release: string | null
  readonly failCode: string | null
}

export interface ListRunsQuery {
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
  readonly runs: ReadonlyArray<ListedRun>
  readonly nextCursor: string | null
  readonly total: number
  readonly limit: number
}

export interface WorkflowRepositoryService {
  readonly append: (
    projectId: string,
    eventId: string,
    event: WorkflowEvent,
  ) => Effect.Effect<AppendDisposition, PersistenceError | RunNotFound>
  readonly snapshot: (
    projectId: string,
  ) => Effect.Effect<ProjectSnapshot, PersistenceError>
  readonly listRuns: (
    projectId: string,
    query: ListRunsQuery,
  ) => Effect.Effect<ListedRunsPage, PersistenceError>
  readonly timeline: (
    projectId: string,
    runId: string,
  ) => Effect.Effect<ReadonlyArray<RunTimelineEvent>, PersistenceError>
  readonly related: (
    projectId: string,
    runId: string,
  ) => Effect.Effect<RelatedRuns, PersistenceError>
  readonly compare: (
    projectId: string,
    runId: string,
  ) => Effect.Effect<RunComparison, PersistenceError>
  readonly intelligence: (
    projectId: string,
    query: IntelligenceQuery,
  ) => Effect.Effect<WorkflowIntelligence, PersistenceError>
}
export class WorkflowRepository extends Context.Service<
  WorkflowRepository,
  WorkflowRepositoryService
>()("@flowmark/api/WorkflowRepository") {}
