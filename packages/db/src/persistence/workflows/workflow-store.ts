import type { BusinessInsightsQuery, BusinessInsights } from "@flowmarkdev/core"
import { getBusinessInsights } from "./queries/get-business-insights.js"
import { Context, Effect, Layer } from "effect"
import type { AppendDisposition, WorkflowEvent } from "@flowmarkdev/core"
import {
  Database,
  DatabaseError,
  MissingRunError,
  InvalidResultQuery,
  provideDatabase,
} from "../database.js"
import { getProjectSnapshot } from "./queries/get-project-snapshot.js"
import { getRelatedRuns } from "./queries/get-related-runs.js"
import { getRunComparison } from "./queries/get-run-comparison.js"
import { getWorkflowIntelligence } from "./queries/get-workflow-intelligence.js"
import {
  getRunTimeline,
  type RunTimelineEvent,
} from "./queries/get-run-timeline.js"
import { listRuns } from "./queries/list-runs.js"
import { appendEvent } from "./writes/append-event.js"
import type {
  ListedRunsPage,
  ListRunsQuery,
  ProjectSnapshot,
  RelatedRuns,
  RunComparison,
  WorkflowIntelligence,
  IntelligenceQuery,
} from "./types.js"

export interface WorkflowStoreService {
  readonly businessInsights: (
    projectId: string,
    query: BusinessInsightsQuery,
  ) => Effect.Effect<BusinessInsights, DatabaseError | InvalidResultQuery>
  readonly append: (
    projectId: string,
    eventId: string,
    event: WorkflowEvent,
  ) => Effect.Effect<AppendDisposition, DatabaseError | MissingRunError>
  readonly snapshot: (
    projectId: string,
  ) => Effect.Effect<ProjectSnapshot, DatabaseError>
  readonly listRuns: (
    projectId: string,
    query: ListRunsQuery,
  ) => Effect.Effect<ListedRunsPage, DatabaseError | InvalidResultQuery>
  readonly timeline: (
    projectId: string,
    runId: string,
  ) => Effect.Effect<ReadonlyArray<RunTimelineEvent>, DatabaseError>
  readonly related: (
    projectId: string,
    runId: string,
  ) => Effect.Effect<RelatedRuns, DatabaseError>
  readonly compare: (
    projectId: string,
    runId: string,
  ) => Effect.Effect<RunComparison, DatabaseError>
  readonly intelligence: (
    projectId: string,
    query: IntelligenceQuery,
  ) => Effect.Effect<WorkflowIntelligence, DatabaseError>
}
export class WorkflowStore extends Context.Service<WorkflowStore>()(
  "@flowmark/db/WorkflowStore",
  {
    make: Effect.gen(function* () {
      const provide = provideDatabase(yield* Database)
      return {
        businessInsights: (projectId, query) =>
          provide(getBusinessInsights(projectId, query)),
        append: (projectId, eventId, event) =>
          provide(appendEvent(projectId, eventId, event)),
        snapshot: (projectId) => provide(getProjectSnapshot(projectId)),
        listRuns: (projectId, query) => provide(listRuns(projectId, query)),
        timeline: (projectId, runId) =>
          provide(getRunTimeline(projectId, runId)),
        related: (projectId, runId) =>
          provide(getRelatedRuns(projectId, runId)),
        compare: (projectId, runId) =>
          provide(getRunComparison(projectId, runId)),
        intelligence: (projectId, query) =>
          provide(getWorkflowIntelligence(projectId, query)),
      } satisfies WorkflowStoreService
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make)
}
