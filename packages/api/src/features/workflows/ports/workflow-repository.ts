import type { PeriodReadInput, PeriodReadResponse } from "@flowmarkdev/core"
import type { PublicReadFailure } from "../../public-reads/errors.js"
import type { RunReadInput, RunReadResponse } from "@flowmarkdev/core"
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
  WorkflowSummary,
  ProjectSearch,
} from "../types.js"

export interface WorkflowRepositoryService {
  readonly periodRead: (
    projectId: string,
    input: PeriodReadInput,
  ) => Effect.Effect<PeriodReadResponse["report"], PublicReadFailure>
  readonly runRead: (
    projectId: string,
    input: RunReadInput,
  ) => Effect.Effect<
    Pick<RunReadResponse, "summary" | "page">,
    PublicReadFailure
  >
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
  readonly relatedRunsPage: (
    projectId: string,
    query: RelatedRunsPageQuery,
  ) => Effect.Effect<RelatedRunsPage, PersistenceError | InvalidInput>
  readonly expectationsPage: (
    projectId: string,
    query: RunExpectationsPageQuery,
  ) => Effect.Effect<RunExpectationsPage, PersistenceError | InvalidInput>
  readonly operationsPage: (
    projectId: string,
    query: RunOperationsPageQuery,
  ) => Effect.Effect<RunOperationsPage, PersistenceError | InvalidInput>
  readonly discoverWorkflows: (
    projectId: string,
    query: WorkflowDiscoveryQuery,
  ) => Effect.Effect<WorkflowDiscoveryPage, PersistenceError | InvalidInput>
  readonly discoverWorkflowMeaning: (
    projectId: string,
    query: WorkflowMeaningQuery,
  ) => Effect.Effect<WorkflowMeaningPage, PersistenceError | InvalidInput>
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
