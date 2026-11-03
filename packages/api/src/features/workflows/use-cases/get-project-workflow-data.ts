import type { RunExpectations } from "@flowmarkdev/core"
import type { PeerSelection } from "@flowmarkdev/core"
import type { BusinessInsightsQuery, BusinessInsights } from "@flowmarkdev/core"
import { Context, Effect, Layer, Match, Schema } from "effect"
import {
  InvalidInput,
  type PersistenceError,
  type Unauthorized,
} from "../../../errors.js"
import { AuthorizeProject } from "../../project-access/use-cases/authorize-project.js"
import {
  PeriodReportQuerySchema,
  periodReportWindowMessage,
} from "../period-report-query.js"
import { WorkflowRepository } from "../ports/workflow-repository.js"
import type {
  IntelligenceQuery,
  ListRunsQuery,
  ListedRunsPage,
  PeriodReport,
  ProjectSnapshot,
  RelatedRuns,
  RunComparison,
  RunTimelineEvent,
  WorkflowIntelligence,
  ProjectSearch,
} from "../types.js"

export type ProjectReader =
  | { readonly _tag: "Key"; readonly header: string | null }
  | {
      readonly _tag: "User"
      readonly userId: string
      readonly projectId?: string
    }

export interface GetProjectWorkflowDataService {
  readonly expectations: (
    reader: ProjectReader,
    runId: string,
  ) => Effect.Effect<RunExpectations, Unauthorized | PersistenceError>
  readonly businessInsights: (
    reader: ProjectReader,
    query: BusinessInsightsQuery,
  ) => Effect.Effect<
    BusinessInsights,
    Unauthorized | PersistenceError | InvalidInput
  >
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
  readonly search: (
    reader: ProjectReader,
    query: string,
  ) => Effect.Effect<
    ProjectSearch,
    Unauthorized | PersistenceError | InvalidInput
  >
  readonly timeline: (
    reader: ProjectReader,
    runId: string,
  ) => Effect.Effect<
    ReadonlyArray<RunTimelineEvent>,
    Unauthorized | PersistenceError
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
export class GetProjectWorkflowData extends Context.Service<
  GetProjectWorkflowData,
  GetProjectWorkflowDataService
>()("@flowmark/api/GetProjectWorkflowData") {
  static readonly layer = Layer.effect(
    GetProjectWorkflowData,
    Effect.gen(function* () {
      const authorization = yield* AuthorizeProject
      const repository = yield* WorkflowRepository

      const authorizeReader = Effect.fn(
        "GetProjectWorkflowData.authorizeReader",
      )(function* (reader: ProjectReader) {
        return yield* Match.value(reader).pipe(
          Match.tag("Key", ({ header }) =>
            authorization.authorize(header, "read"),
          ),
          Match.tag("User", ({ userId, projectId }) =>
            authorization.authorizeUser(userId, projectId),
          ),
          Match.exhaustive,
        )
      })

      const snapshot = Effect.fn("GetProjectWorkflowData.snapshot")(function* (
        reader: ProjectReader,
      ) {
        const projectId = yield* authorizeReader(reader)
        return yield* repository.snapshot(projectId)
      })
      const workflows = Effect.fn("GetProjectWorkflowData.workflows")(
        function* (reader: ProjectReader) {
          const projectId = yield* authorizeReader(reader)
          return yield* repository.workflows(projectId)
        },
      )
      const listRuns = Effect.fn("GetProjectWorkflowData.listRuns")(function* (
        reader: ProjectReader,
        query: ListRunsQuery,
      ) {
        const projectId = yield* authorizeReader(reader)
        return yield* repository.listRuns(projectId, query)
      })
      const search = Effect.fn("GetProjectWorkflowData.search")(function* (
        reader: ProjectReader,
        query: string,
      ) {
        const projectId = yield* authorizeReader(reader)
        const text = query.trim().slice(0, 200)
        if (text.length === 0) {
          return {
            workflows: [],
            runs: [],
            references: [],
          } satisfies ProjectSearch
        }
        return yield* repository.search(projectId, text)
      })
      const timeline = Effect.fn("GetProjectWorkflowData.timeline")(function* (
        reader: ProjectReader,
        runId: string,
      ) {
        const projectId = yield* authorizeReader(reader)
        return yield* repository.timeline(projectId, runId)
      })
      const related = Effect.fn("GetProjectWorkflowData.related")(function* (
        reader: ProjectReader,
        runId: string,
      ) {
        const projectId = yield* authorizeReader(reader)
        return yield* repository.related(projectId, runId)
      })
      const compare = Effect.fn("GetProjectWorkflowData.compare")(function* (
        reader: ProjectReader,
        runId: string,
        selection: PeerSelection = {},
      ) {
        const projectId = yield* authorizeReader(reader)
        return yield* repository.compare(projectId, runId, selection)
      })
      const intelligence = Effect.fn("GetProjectWorkflowData.intelligence")(
        function* (reader: ProjectReader, query: IntelligenceQuery) {
          const projectId = yield* authorizeReader(reader)
          return yield* repository.intelligence(projectId, query)
        },
      )
      const periodReport = Effect.fn("GetProjectWorkflowData.periodReport")(
        function* (reader: ProjectReader, query: IntelligenceQuery) {
          if (!Schema.is(PeriodReportQuerySchema)(query)) {
            return yield* new InvalidInput({ cause: periodReportWindowMessage })
          }
          const projectId = yield* authorizeReader(reader)
          return yield* repository.periodReport(projectId, query)
        },
      )
      const businessInsights = Effect.fn(
        "GetProjectWorkflowData.businessInsights",
      )(function* (reader: ProjectReader, query: BusinessInsightsQuery) {
        return yield* repository.businessInsights(
          yield* authorizeReader(reader),
          query,
        )
      })

      return GetProjectWorkflowData.of({
        expectations: Effect.fn("GetProjectWorkflowData.expectations")(
          function* (reader, runId) {
            return yield* repository.expectations(
              yield* authorizeReader(reader),
              runId,
            )
          },
        ),
        businessInsights,
        snapshot,
        workflows,
        listRuns,
        search,
        timeline,
        related,
        compare,
        intelligence,
        periodReport,
      })
    }),
  )
}
