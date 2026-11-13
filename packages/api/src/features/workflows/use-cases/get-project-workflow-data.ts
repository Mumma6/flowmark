import { CurrentProjectReader } from "../models/current-project-reader.js"
import {
  ReferenceJourneyQuerySchema,
  LinkedComparisonQuerySchema,
  LinkedEvidenceQuerySchema,
  type ReferenceJourneyQuery,
} from "@flowmarkdev/core"
import type { PeerSelection } from "@flowmarkdev/core"
import type { BusinessInsightsQuery } from "@flowmarkdev/core"
import { Context, Effect, Layer, Match, Schema } from "effect"
import { InvalidInput } from "../../../errors.js"
import { AgentAccess } from "../../project-access/ports/agent-access.js"
import { AuthorizeProject } from "../../project-access/use-cases/authorize-project.js"
import {
  PeriodReportQuerySchema,
  periodReportWindowMessage,
} from "../period-report-query.js"
import { WorkflowRepository } from "../ports/workflow-repository.js"
import type {
  IntelligenceQuery,
  ListRunsQuery,
  RunEventPageQuery,
  RelatedRunsPageQuery,
  RunExpectationsPageQuery,
  RunOperationsPageQuery,
  WorkflowDiscoveryQuery,
  WorkflowMeaningQuery,
  ProjectSearch,
} from "../types.js"
import type { ProjectReader } from "../models/project-reader.js"
import type {
  ProjectReadRuns,
  ProjectReadAnalytics,
  ProjectReadDiscovery,
} from "./project-read-capabilities.ts"
export interface GetProjectWorkflowDataService
  extends ProjectReadRuns, ProjectReadAnalytics, ProjectReadDiscovery {}
export class GetProjectWorkflowData extends Context.Service<
  GetProjectWorkflowData,
  GetProjectWorkflowDataService
>()("@flowmark/api/GetProjectWorkflowData") {
  static readonly layer = Layer.effect(
    GetProjectWorkflowData,
    Effect.gen(function* () {
      const authorization = yield* AuthorizeProject
      const repository = yield* WorkflowRepository
      const agentAccess = yield* AgentAccess

      const authorizeReader = Effect.fn(
        "GetProjectWorkflowData.authorizeReader",
      )(function* (reader: ProjectReader) {
        return yield* Match.value(reader).pipe(
          Match.tag("Key", ({ header }) =>
            authorization.authorize(header, "read"),
          ),
          Match.tag("User", ({ userId, projectId }) =>
            authorization.authorizeDiagnosticUser(userId, projectId),
          ),
          Match.tag("DelegatedUser", (delegated) =>
            Effect.gen(function* () {
              const projectId =
                yield* authorization.authorizeDelegatedReader(delegated)
              yield* authorization.authorizeDiagnosticUser(
                delegated.userId,
                projectId,
              )
              yield* agentAccess.recordLastAuthenticated({
                userId: delegated.userId,
                clientId: delegated.clientId,
                authorizationCodeId: delegated.authorizationCodeId,
                at: new Date(),
              })
              return projectId
            }),
          ),
          Match.exhaustive,
        )
      })

      const snapshot = Effect.fn("GetProjectWorkflowData.snapshot")(function* (
        reader: ProjectReader,
      ) {
        const projectId = yield* authorizeReader(reader)
        return yield* repository
          .snapshot(projectId)
          .pipe(Effect.provideService(CurrentProjectReader, reader))
      })
      const workflows = Effect.fn("GetProjectWorkflowData.workflows")(
        function* (reader: ProjectReader) {
          const projectId = yield* authorizeReader(reader)
          return yield* repository
            .workflows(projectId)
            .pipe(Effect.provideService(CurrentProjectReader, reader))
        },
      )
      const listRuns = Effect.fn("GetProjectWorkflowData.listRuns")(function* (
        reader: ProjectReader,
        query: ListRunsQuery,
      ) {
        const projectId = yield* authorizeReader(reader)
        return yield* repository
          .listRuns(projectId, query)
          .pipe(Effect.provideService(CurrentProjectReader, reader))
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
        return yield* repository
          .search(projectId, text)
          .pipe(Effect.provideService(CurrentProjectReader, reader))
      })
      const timeline = Effect.fn("GetProjectWorkflowData.timeline")(function* (
        reader: ProjectReader,
        runId: string,
      ) {
        const projectId = yield* authorizeReader(reader)
        return yield* repository
          .timeline(projectId, runId)
          .pipe(Effect.provideService(CurrentProjectReader, reader))
      })
      const runEventPage = Effect.fn("GetProjectWorkflowData.runEventPage")(
        function* (reader: ProjectReader, query: RunEventPageQuery) {
          const projectId = yield* authorizeReader(reader)
          return yield* repository
            .runEventPage(projectId, query)
            .pipe(Effect.provideService(CurrentProjectReader, reader))
        },
      )
      const runInvestigationSummary = Effect.fn(
        "GetProjectWorkflowData.runInvestigationSummary",
      )(function* (reader: ProjectReader, runId: string) {
        const projectId = yield* authorizeReader(reader)
        return yield* repository
          .runInvestigationSummary(projectId, runId)
          .pipe(Effect.provideService(CurrentProjectReader, reader))
      })
      const relatedRunsPage = Effect.fn(
        "GetProjectWorkflowData.relatedRunsPage",
      )(function* (reader: ProjectReader, query: RelatedRunsPageQuery) {
        const projectId = yield* authorizeReader(reader)
        return yield* repository
          .relatedRunsPage(projectId, query)
          .pipe(Effect.provideService(CurrentProjectReader, reader))
      })
      const expectationsPage = Effect.fn(
        "GetProjectWorkflowData.expectationsPage",
      )(function* (reader: ProjectReader, query: RunExpectationsPageQuery) {
        const projectId = yield* authorizeReader(reader)
        return yield* repository
          .expectationsPage(projectId, query)
          .pipe(Effect.provideService(CurrentProjectReader, reader))
      })
      const operationsPage = Effect.fn("GetProjectWorkflowData.operationsPage")(
        function* (reader: ProjectReader, query: RunOperationsPageQuery) {
          const projectId = yield* authorizeReader(reader)
          return yield* repository
            .operationsPage(projectId, query)
            .pipe(Effect.provideService(CurrentProjectReader, reader))
        },
      )
      const discoverWorkflows = Effect.fn(
        "GetProjectWorkflowData.discoverWorkflows",
      )(function* (reader: ProjectReader, query: WorkflowDiscoveryQuery) {
        const projectId = yield* authorizeReader(reader)
        return yield* repository
          .discoverWorkflows(projectId, query)
          .pipe(Effect.provideService(CurrentProjectReader, reader))
      })
      const discoverWorkflowMeaning = Effect.fn(
        "GetProjectWorkflowData.discoverWorkflowMeaning",
      )(function* (reader: ProjectReader, query: WorkflowMeaningQuery) {
        const projectId = yield* authorizeReader(reader)
        return yield* repository
          .discoverWorkflowMeaning(projectId, query)
          .pipe(Effect.provideService(CurrentProjectReader, reader))
      })
      const related = Effect.fn("GetProjectWorkflowData.related")(function* (
        reader: ProjectReader,
        runId: string,
      ) {
        const projectId = yield* authorizeReader(reader)
        return yield* repository
          .related(projectId, runId)
          .pipe(Effect.provideService(CurrentProjectReader, reader))
      })
      const compare = Effect.fn("GetProjectWorkflowData.compare")(function* (
        reader: ProjectReader,
        runId: string,
        selection: PeerSelection = {},
      ) {
        const projectId = yield* authorizeReader(reader)
        return yield* repository
          .compare(projectId, runId, selection)
          .pipe(Effect.provideService(CurrentProjectReader, reader))
      })
      const intelligence = Effect.fn("GetProjectWorkflowData.intelligence")(
        function* (reader: ProjectReader, query: IntelligenceQuery) {
          const projectId = yield* authorizeReader(reader)
          return yield* repository
            .intelligence(projectId, query)
            .pipe(Effect.provideService(CurrentProjectReader, reader))
        },
      )
      const periodReport = Effect.fn("GetProjectWorkflowData.periodReport")(
        function* (reader: ProjectReader, query: IntelligenceQuery) {
          if (!Schema.is(PeriodReportQuerySchema)(query)) {
            return yield* new InvalidInput({ cause: periodReportWindowMessage })
          }
          const projectId = yield* authorizeReader(reader)
          return yield* repository
            .periodReport(projectId, query)
            .pipe(Effect.provideService(CurrentProjectReader, reader))
        },
      )
      const businessInsights = Effect.fn(
        "GetProjectWorkflowData.businessInsights",
      )(function* (reader: ProjectReader, query: BusinessInsightsQuery) {
        return yield* repository
          .businessInsights(yield* authorizeReader(reader), query)
          .pipe(Effect.provideService(CurrentProjectReader, reader))
      })

      return GetProjectWorkflowData.of({
        linkedComparison: Effect.fn("GetProjectWorkflowData.linkedComparison")(
          function* (reader, input) {
            const projectId = yield* authorizeReader(reader)
            const query = yield* Schema.decodeUnknownEffect(
              LinkedComparisonQuerySchema,
              { onExcessProperty: "error" },
            )(input).pipe(
              Effect.mapError((cause) => new InvalidInput({ cause })),
            )
            return yield* repository
              .linkedComparison(projectId, query)
              .pipe(Effect.provideService(CurrentProjectReader, reader))
          },
        ),
        linkedEvidence: Effect.fn("GetProjectWorkflowData.linkedEvidence")(
          function* (reader, input) {
            const projectId = yield* authorizeReader(reader)
            const query = yield* Schema.decodeUnknownEffect(
              LinkedEvidenceQuerySchema,
              { onExcessProperty: "error" },
            )(input).pipe(
              Effect.mapError((cause) => new InvalidInput({ cause })),
            )
            return yield* repository
              .linkedEvidence(projectId, query)
              .pipe(Effect.provideService(CurrentProjectReader, reader))
          },
        ),
        referenceJourney: Effect.fn("GetProjectWorkflowData.referenceJourney")(
          function* (reader: ProjectReader, input: ReferenceJourneyQuery) {
            const projectId = yield* authorizeReader(reader)
            const query = yield* Schema.decodeUnknownEffect(
              ReferenceJourneyQuerySchema,
            )(input, { onExcessProperty: "error" }).pipe(
              Effect.mapError((cause) => new InvalidInput({ cause })),
            )
            return yield* repository
              .referenceJourney(projectId, query)
              .pipe(Effect.provideService(CurrentProjectReader, reader))
          },
        ),
        expectations: Effect.fn("GetProjectWorkflowData.expectations")(
          function* (reader, runId) {
            return yield* repository
              .expectations(yield* authorizeReader(reader), runId)
              .pipe(Effect.provideService(CurrentProjectReader, reader))
          },
        ),
        businessInsights,
        snapshot,
        workflows,
        listRuns,
        search,
        timeline,
        runEventPage,
        runInvestigationSummary,
        relatedRunsPage,
        expectationsPage,
        operationsPage,
        discoverWorkflows,
        discoverWorkflowMeaning,
        related,
        compare,
        intelligence,
        periodReport,
      })
    }),
  )
}

export type { ProjectReader } from "../models/project-reader.js"
