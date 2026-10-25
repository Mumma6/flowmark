import { Context, type Effect } from "effect"
import type {
  WorkflowError,
  WorkflowFailure,
  WorkflowEvent,
  WorkflowProperties,
  WorkflowResult,
} from "@flowmark/core"
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

export interface RunComparison {
  readonly current: StoredRun | null
  readonly peers: ReadonlyArray<StoredRun>
  readonly peerSuccessRate: number | null
  readonly peerMedianDurationMs: number | null
  readonly peerP95DurationMs: number | null
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
  readonly result: WorkflowResult | null
  readonly timestamp: string
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

export interface WorkflowRepositoryService {
  readonly append: (
    projectId: string,
    eventId: string,
    event: WorkflowEvent,
  ) => Effect.Effect<void, PersistenceError | RunNotFound>
  readonly snapshot: (
    projectId: string,
  ) => Effect.Effect<ProjectSnapshot, PersistenceError>
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
}

export class WorkflowRepository extends Context.Tag(
  "@flowmark/api/WorkflowRepository",
)<WorkflowRepository, WorkflowRepositoryService>() {}
