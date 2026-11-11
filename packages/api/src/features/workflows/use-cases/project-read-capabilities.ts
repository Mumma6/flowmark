import type {
  RunExpectations,
  PeerSelection,
  BusinessInsightsQuery,
  BusinessInsights,
} from "@flowmarkdev/core"
import type { Effect } from "effect"
import type {
  InvalidInput,
  PersistenceError,
  Unauthorized,
} from "../../../errors.js"
import type {
  IntelligenceQuery,
  ListRunsQuery,
  ListedRunsPage,
  PeriodReport,
  ProjectSnapshot,
  RelatedRuns,
  RunComparison,
  RunEventPage,
  RunEventPageQuery,
  RunInvestigationSummary,
  RelatedRunsPage,
  RelatedRunsPageQuery,
  RunExpectationsPage,
  RunExpectationsPageQuery,
  RunOperationsPage,
  RunOperationsPageQuery,
  WorkflowDiscoveryPage,
  WorkflowDiscoveryQuery,
  WorkflowMeaningPage,
  WorkflowMeaningQuery,
  RunTimelineEvent,
  WorkflowIntelligence,
  ProjectSearch,
} from "../types.js"

import type { ProjectReader } from "../models/project-reader.js"
export interface ProjectReadRuns {
  readonly expectations: (
    reader: ProjectReader,
    runId: string,
  ) => Effect.Effect<RunExpectations, Unauthorized | PersistenceError>
  readonly snapshot: (
    reader: ProjectReader,
  ) => Effect.Effect<ProjectSnapshot, Unauthorized | PersistenceError>
  readonly workflows: (
    reader: ProjectReader,
  ) => Effect.Effect<
    ProjectSnapshot["workflows"],
    Unauthorized | PersistenceError
  >
  readonly listRuns: (
    reader: ProjectReader,
    query: ListRunsQuery,
  ) => Effect.Effect<
    ListedRunsPage,
    Unauthorized | PersistenceError | InvalidInput
  >
  readonly timeline: (
    reader: ProjectReader,
    runId: string,
  ) => Effect.Effect<
    ReadonlyArray<RunTimelineEvent>,
    Unauthorized | PersistenceError
  >
  readonly runEventPage: (
    reader: ProjectReader,
    query: RunEventPageQuery,
  ) => Effect.Effect<
    RunEventPage,
    Unauthorized | PersistenceError | InvalidInput
  >
  readonly runInvestigationSummary: (
    reader: ProjectReader,
    runId: string,
  ) => Effect.Effect<
    RunInvestigationSummary,
    Unauthorized | PersistenceError | InvalidInput
  >
  readonly relatedRunsPage: (
    reader: ProjectReader,
    query: RelatedRunsPageQuery,
  ) => Effect.Effect<
    RelatedRunsPage,
    Unauthorized | PersistenceError | InvalidInput
  >
  readonly expectationsPage: (
    reader: ProjectReader,
    query: RunExpectationsPageQuery,
  ) => Effect.Effect<
    RunExpectationsPage,
    Unauthorized | PersistenceError | InvalidInput
  >
  readonly operationsPage: (
    reader: ProjectReader,
    query: RunOperationsPageQuery,
  ) => Effect.Effect<
    RunOperationsPage,
    Unauthorized | PersistenceError | InvalidInput
  >
  readonly related: (
    reader: ProjectReader,
    runId: string,
  ) => Effect.Effect<RelatedRuns, Unauthorized | PersistenceError>
  readonly compare: (
    reader: ProjectReader,
    runId: string,
    selection?: PeerSelection,
  ) => Effect.Effect<
    RunComparison,
    Unauthorized | PersistenceError | InvalidInput
  >
}

export interface ProjectReadAnalytics {
  readonly businessInsights: (
    reader: ProjectReader,
    query: BusinessInsightsQuery,
  ) => Effect.Effect<
    BusinessInsights,
    Unauthorized | PersistenceError | InvalidInput
  >
  readonly intelligence: (
    reader: ProjectReader,
    query: IntelligenceQuery,
  ) => Effect.Effect<WorkflowIntelligence, Unauthorized | PersistenceError>
  readonly periodReport: (
    reader: ProjectReader,
    query: IntelligenceQuery,
  ) => Effect.Effect<
    PeriodReport,
    Unauthorized | PersistenceError | InvalidInput
  >
}

export interface ProjectReadDiscovery {
  readonly search: (
    reader: ProjectReader,
    query: string,
  ) => Effect.Effect<
    ProjectSearch,
    Unauthorized | PersistenceError | InvalidInput
  >
  readonly discoverWorkflows: (
    reader: ProjectReader,
    query: WorkflowDiscoveryQuery,
  ) => Effect.Effect<
    WorkflowDiscoveryPage,
    Unauthorized | PersistenceError | InvalidInput
  >
  readonly discoverWorkflowMeaning: (
    reader: ProjectReader,
    query: WorkflowMeaningQuery,
  ) => Effect.Effect<
    WorkflowMeaningPage,
    Unauthorized | PersistenceError | InvalidInput
  >
}
