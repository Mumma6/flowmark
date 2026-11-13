import type {
  ReferenceJourneyQuery,
  ReferenceJourneyPage,
} from "@flowmarkdev/core"
import type {
  LinkedComparisonQuery,
  LinkedComparison,
  LinkedEvidenceQuery,
  LinkedEvidencePage,
} from "@flowmarkdev/core"
import type { PeriodReadInput, PeriodReadResponse } from "@flowmarkdev/core"
import type { PublicReadFailure } from "../../public-reads/errors.js"
import type { RunReadInput, RunReadResponse } from "@flowmarkdev/core"
import type {
  BusinessInsights,
  BusinessInsightsQuery,
  PeerSelection,
  RunExpectations,
} from "@flowmarkdev/core"
import type { Effect } from "effect"
import type { InvalidInput, PersistenceError } from "../../../errors.js"
import type {
  IntelligenceQuery,
  ListRunsQuery,
  ListedRunsPage,
  PeriodReport,
  ProjectSnapshot,
  RelatedRuns,
  RunComparisonEvidence,
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

export interface WorkflowRepositoryRuns {
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
  readonly related: (
    projectId: string,
    runId: string,
  ) => Effect.Effect<RelatedRuns, PersistenceError>
  readonly comparisonEvidence: (
    projectId: string,
    runId: string,
    selection?: PeerSelection,
  ) => Effect.Effect<RunComparisonEvidence, PersistenceError | InvalidInput>
}

export interface WorkflowRepositoryAnalytics {
  readonly linkedComparison: (
    projectId: string,
    query: LinkedComparisonQuery,
  ) => Effect.Effect<LinkedComparison, PersistenceError | InvalidInput>
  readonly linkedEvidence: (
    projectId: string,
    query: LinkedEvidenceQuery,
  ) => Effect.Effect<LinkedEvidencePage, PersistenceError | InvalidInput>
  readonly periodRead: (
    projectId: string,
    input: PeriodReadInput,
  ) => Effect.Effect<PeriodReadResponse["report"], PublicReadFailure>
  readonly businessInsights: (
    projectId: string,
    query: BusinessInsightsQuery,
  ) => Effect.Effect<BusinessInsights, PersistenceError | InvalidInput>
  readonly intelligence: (
    projectId: string,
    query: IntelligenceQuery,
  ) => Effect.Effect<WorkflowIntelligence, PersistenceError>
  readonly periodReport: (
    projectId: string,
    query: IntelligenceQuery,
  ) => Effect.Effect<PeriodReport, PersistenceError>
}

export interface WorkflowRepositoryDiscovery {
  readonly referenceJourney: (
    projectId: string,
    query: ReferenceJourneyQuery,
  ) => Effect.Effect<ReferenceJourneyPage, PersistenceError | InvalidInput>
  readonly search: (
    projectId: string,
    query: string,
  ) => Effect.Effect<ProjectSearch, PersistenceError | InvalidInput>
  readonly discoverWorkflows: (
    projectId: string,
    query: WorkflowDiscoveryQuery,
  ) => Effect.Effect<WorkflowDiscoveryPage, PersistenceError | InvalidInput>
  readonly discoverWorkflowMeaning: (
    projectId: string,
    query: WorkflowMeaningQuery,
  ) => Effect.Effect<WorkflowMeaningPage, PersistenceError | InvalidInput>
}
