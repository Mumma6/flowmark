import type {
  AppendDisposition,
  BusinessInsights,
  BusinessInsightsQuery,
  PeerSelection,
  RunExpectations,
  WorkflowEvent,
} from "@flowmarkdev/core"
import { Context, type Effect } from "effect"
import type {
  InvalidInput,
  PersistenceError,
  RunNotFound,
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
  RunTimelineEvent,
  WorkflowIntelligence,
  WorkflowSummary,
  ProjectSearch,
} from "../types.js"

export interface WorkflowRepositoryService {
  readonly expectations: (
    projectId: string,
    runId: string,
  ) => Effect.Effect<RunExpectations, PersistenceError>
  readonly businessInsights: (
    projectId: string,
    query: BusinessInsightsQuery,
  ) => Effect.Effect<BusinessInsights, PersistenceError | InvalidInput>
  readonly append: (
    projectId: string,
    eventId: string,
    event: WorkflowEvent,
  ) => Effect.Effect<AppendDisposition, PersistenceError | RunNotFound>
  readonly snapshot: (
    projectId: string,
  ) => Effect.Effect<ProjectSnapshot, PersistenceError>
  readonly workflows: (
    projectId: string,
  ) => Effect.Effect<ReadonlyArray<WorkflowSummary>, PersistenceError>
  readonly listRuns: (
    projectId: string,
    query: ListRunsQuery,
  ) => Effect.Effect<ListedRunsPage, PersistenceError | InvalidInput>
  readonly search: (
    projectId: string,
    query: string,
  ) => Effect.Effect<ProjectSearch, PersistenceError | InvalidInput>
  readonly timeline: (
    projectId: string,
    runId: string,
  ) => Effect.Effect<ReadonlyArray<RunTimelineEvent>, PersistenceError>
  readonly runEventPage: (
    projectId: string,
    query: RunEventPageQuery,
  ) => Effect.Effect<RunEventPage, PersistenceError | InvalidInput>
  readonly runInvestigationSummary: (
    projectId: string,
    runId: string,
  ) => Effect.Effect<RunInvestigationSummary, PersistenceError | InvalidInput>
  readonly related: (
    projectId: string,
    runId: string,
  ) => Effect.Effect<RelatedRuns, PersistenceError>
  readonly compare: (
    projectId: string,
    runId: string,
    selection?: PeerSelection,
  ) => Effect.Effect<RunComparison, PersistenceError | InvalidInput>
  readonly intelligence: (
    projectId: string,
    query: IntelligenceQuery,
  ) => Effect.Effect<WorkflowIntelligence, PersistenceError>
  readonly periodReport: (
    projectId: string,
    query: IntelligenceQuery,
  ) => Effect.Effect<PeriodReport, PersistenceError>
}
export class WorkflowRepository extends Context.Service<
  WorkflowRepository,
  WorkflowRepositoryService
>()("@flowmark/api/WorkflowRepository") {}
