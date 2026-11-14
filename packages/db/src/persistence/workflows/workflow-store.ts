import type { ReferenceJourneyEvidence } from "./types.js"
import { withActiveProject } from "../data-lifecycle/with-active-project.js"
import type { ReferenceJourneyQuery } from "@flowmarkdev/core"
import { getReferenceJourney } from "./queries/get-reference-journey.js"
import { getLinkedComparison } from "./queries/get-linked-comparison.js"
import { getLinkedEvidence } from "./queries/get-linked-evidence.js"
import type {
  LinkedComparisonQuery,
  LinkedComparison,
  LinkedEvidenceQuery,
  LinkedEvidencePage,
} from "@flowmarkdev/core"
import { getPeriodRead } from "./queries/get-period-read.js"
import type { PeriodReadInput, PeriodReadResponse } from "@flowmarkdev/core"
import { getRunRead } from "./queries/get-run-read.js"
import { InvalidRunReadCursor } from "./public-read-errors.js"
import type { RunReadInput, RunReadResponse } from "@flowmarkdev/core"
import { getRunExpectations } from "./queries/get-run-expectations.js"
import type { RunExpectations } from "@flowmarkdev/core"
import type { PeerSelection } from "@flowmarkdev/core"
import type { BusinessInsightsQuery, BusinessInsights } from "@flowmarkdev/core"
import { getBusinessInsights } from "./queries/get-business-insights.js"
import { Context, Effect, Layer } from "effect"
import type { AppendDisposition, WorkflowEvent } from "@flowmarkdev/core"
import {
  Database,
  DatabaseError,
  MissingRunError,
  IngestionRejected,
  InvalidResultQuery,
  provideDatabase,
  DatabaseCancellation,
} from "../database.js"
import { getProjectSnapshot } from "./queries/get-project-snapshot.js"
import { getWorkflowSummaries } from "./queries/get-workflow-summaries.js"
import { getRelatedRuns } from "./queries/get-related-runs.js"
import { getRunComparisonEvidence } from "./queries/get-run-comparison-evidence.js"
import { getPeriodReport } from "./queries/get-period-report.js"
import { getWorkflowIntelligence } from "./queries/get-workflow-intelligence.js"
import {
  getRunTimeline,
  type RunTimelineEvent,
} from "./queries/get-run-timeline.js"
import { getRunEventPage } from "./queries/get-run-event-page.js"
import { getRunInvestigationSummary } from "./queries/get-run-investigation-summary.js"
import { getRelatedRunsPage } from "./queries/get-related-runs-page.js"
import { getRunExpectationsPage } from "./queries/get-run-expectations-page.js"
import { getRunOperationsPage } from "./queries/get-run-operations-page.js"
import { getWorkflowDiscoveryPage } from "./queries/get-workflow-discovery-page.js"
import { getWorkflowMeaningPage } from "./queries/get-workflow-meaning-page.js"
import { listRuns } from "./queries/list-runs.js"
import { searchProject } from "./queries/search-project.js"
import { appendEvent } from "./writes/append-event.js"
import type {
  ListedRunsPage,
  ListRunsQuery,
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
  PeriodReport,
  WorkflowIntelligence,
  WorkflowSummary,
  IntelligenceQuery,
  ProjectSearch,
} from "./types.js"

export interface WorkflowStoreService {
  readonly linkedComparison: (
    projectId: string,
    query: LinkedComparisonQuery,
  ) => Effect.Effect<LinkedComparison, DatabaseError | InvalidResultQuery>
  readonly linkedEvidence: (
    projectId: string,
    query: LinkedEvidenceQuery,
  ) => Effect.Effect<LinkedEvidencePage, DatabaseError | InvalidResultQuery>
  readonly referenceJourney: (
    projectId: string,
    query: ReferenceJourneyQuery,
  ) => Effect.Effect<
    ReferenceJourneyEvidence,
    DatabaseError | InvalidResultQuery
  >
  readonly periodRead: (
    projectId: string,
    input: PeriodReadInput,
  ) => Effect.Effect<PeriodReadResponse["report"], DatabaseError>
  readonly runRead: (
    projectId: string,
    input: RunReadInput,
  ) => Effect.Effect<
    Pick<RunReadResponse, "summary" | "page">,
    DatabaseError | MissingRunError | InvalidRunReadCursor
  >
  readonly expectations: (
    projectId: string,
    runId: string,
  ) => Effect.Effect<RunExpectations, DatabaseError>
  readonly businessInsights: (
    projectId: string,
    query: BusinessInsightsQuery,
  ) => Effect.Effect<BusinessInsights, DatabaseError | InvalidResultQuery>
  readonly append: (
    projectId: string,
    eventId: string,
    event: WorkflowEvent,
    credential?: { readonly kind: "api" | "browser"; readonly keyHash: string },
  ) => Effect.Effect<
    AppendDisposition,
    DatabaseError | MissingRunError | IngestionRejected
  >
  readonly snapshot: (
    projectId: string,
  ) => Effect.Effect<ProjectSnapshot, DatabaseError>
  readonly workflows: (
    projectId: string,
  ) => Effect.Effect<ReadonlyArray<WorkflowSummary>, DatabaseError>
  readonly listRuns: (
    projectId: string,
    query: ListRunsQuery,
  ) => Effect.Effect<ListedRunsPage, DatabaseError | InvalidResultQuery>
  readonly search: (
    projectId: string,
    query: string,
  ) => Effect.Effect<ProjectSearch, DatabaseError | InvalidResultQuery>
  readonly timeline: (
    projectId: string,
    runId: string,
  ) => Effect.Effect<ReadonlyArray<RunTimelineEvent>, DatabaseError>
  readonly runEventPage: (
    projectId: string,
    query: RunEventPageQuery,
  ) => Effect.Effect<RunEventPage, DatabaseError | InvalidResultQuery>
  readonly runInvestigationSummary: (
    projectId: string,
    runId: string,
  ) => Effect.Effect<
    RunInvestigationSummary,
    DatabaseError | InvalidResultQuery
  >
  readonly relatedRunsPage: (
    projectId: string,
    query: RelatedRunsPageQuery,
  ) => Effect.Effect<RelatedRunsPage, DatabaseError | InvalidResultQuery>
  readonly expectationsPage: (
    projectId: string,
    query: RunExpectationsPageQuery,
  ) => Effect.Effect<RunExpectationsPage, DatabaseError | InvalidResultQuery>
  readonly operationsPage: (
    projectId: string,
    query: RunOperationsPageQuery,
  ) => Effect.Effect<RunOperationsPage, DatabaseError | InvalidResultQuery>
  readonly discoverWorkflows: (
    projectId: string,
    query: WorkflowDiscoveryQuery,
  ) => Effect.Effect<WorkflowDiscoveryPage, DatabaseError | InvalidResultQuery>
  readonly discoverWorkflowMeaning: (
    projectId: string,
    query: WorkflowMeaningQuery,
  ) => Effect.Effect<WorkflowMeaningPage, DatabaseError | InvalidResultQuery>
  readonly related: (
    projectId: string,
    runId: string,
  ) => Effect.Effect<RelatedRuns, DatabaseError>
  readonly comparisonEvidence: (
    projectId: string,
    runId: string,
    selection?: PeerSelection,
  ) => Effect.Effect<RunComparisonEvidence, DatabaseError | InvalidResultQuery>
  readonly intelligence: (
    projectId: string,
    query: IntelligenceQuery,
  ) => Effect.Effect<WorkflowIntelligence, DatabaseError>
  readonly periodReport: (
    projectId: string,
    query: IntelligenceQuery,
  ) => Effect.Effect<PeriodReport, DatabaseError>
}
export class WorkflowStore extends Context.Service<WorkflowStore>()(
  "@flowmark/db/WorkflowStore",
  {
    make: Effect.gen(function* () {
      const provide = provideDatabase(
        yield* Database,
        yield* DatabaseCancellation,
      )
      return {
        linkedComparison: (projectId, query) =>
          provide(
            withActiveProject(projectId, getLinkedComparison(projectId, query)),
          ),
        linkedEvidence: (projectId, query) =>
          provide(
            withActiveProject(projectId, getLinkedEvidence(projectId, query)),
          ),
        referenceJourney: (projectId, query) =>
          provide(
            withActiveProject(projectId, getReferenceJourney(projectId, query)),
          ),
        periodRead: (projectId, input) =>
          provide(
            withActiveProject(projectId, getPeriodRead(projectId, input)),
          ),
        runRead: (projectId, input) =>
          provide(withActiveProject(projectId, getRunRead(projectId, input))),
        expectations: (projectId, runId) =>
          provide(
            withActiveProject(projectId, getRunExpectations(projectId, runId)),
          ),
        businessInsights: (projectId, query) =>
          provide(
            withActiveProject(projectId, getBusinessInsights(projectId, query)),
          ),
        append: (
          projectId,
          eventId,
          event,
          credential?: {
            readonly kind: "api" | "browser"
            readonly keyHash: string
          },
        ) => provide(appendEvent(projectId, eventId, event, credential)),
        snapshot: (projectId) =>
          provide(withActiveProject(projectId, getProjectSnapshot(projectId))),
        workflows: (projectId) =>
          provide(
            withActiveProject(projectId, getWorkflowSummaries(projectId)),
          ),
        listRuns: (projectId, query) =>
          provide(withActiveProject(projectId, listRuns(projectId, query))),
        search: (projectId, query) =>
          provide(
            withActiveProject(projectId, searchProject(projectId, query)),
          ),
        timeline: (projectId, runId) =>
          provide(
            withActiveProject(projectId, getRunTimeline(projectId, runId)),
          ),
        runEventPage: (projectId, query) =>
          provide(
            withActiveProject(projectId, getRunEventPage(projectId, query)),
          ),
        runInvestigationSummary: (projectId, runId) =>
          provide(
            withActiveProject(
              projectId,
              getRunInvestigationSummary(projectId, runId),
            ),
          ),
        relatedRunsPage: (projectId, query) =>
          provide(
            withActiveProject(projectId, getRelatedRunsPage(projectId, query)),
          ),
        expectationsPage: (projectId, query) =>
          provide(
            withActiveProject(
              projectId,
              getRunExpectationsPage(projectId, query),
            ),
          ),
        operationsPage: (projectId, query) =>
          provide(
            withActiveProject(
              projectId,
              getRunOperationsPage(projectId, query),
            ),
          ),
        discoverWorkflows: (projectId, query) =>
          provide(
            withActiveProject(
              projectId,
              getWorkflowDiscoveryPage(projectId, query),
            ),
          ),
        discoverWorkflowMeaning: (projectId, query) =>
          provide(
            withActiveProject(
              projectId,
              getWorkflowMeaningPage(projectId, query),
            ),
          ),
        related: (projectId, runId) =>
          provide(
            withActiveProject(projectId, getRelatedRuns(projectId, runId)),
          ),
        comparisonEvidence: (projectId, runId, selection) =>
          provide(
            withActiveProject(
              projectId,
              getRunComparisonEvidence(projectId, runId, selection),
            ),
          ),
        intelligence: (projectId, query) =>
          provide(
            withActiveProject(
              projectId,
              getWorkflowIntelligence(projectId, query),
            ),
          ),
        periodReport: (projectId, query) =>
          provide(
            withActiveProject(projectId, getPeriodReport(projectId, query)),
          ),
      } satisfies WorkflowStoreService
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make)
}
