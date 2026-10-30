import { Context, Effect, Layer } from "effect"
import type { PersistenceError, Unauthorized } from "../../../errors.js"
import { AuthorizeProject } from "../../project-access/use-cases/authorize-project.js"
import {
  WorkflowRepository,
  type ListedRunsPage,
  type IntelligenceQuery,
  type WorkflowIntelligence,
  type ListRunsQuery,
  type ProjectSnapshot,
  type RelatedRuns,
  type RunComparison,
  type RunTimelineEvent,
} from "../ports/workflow-repository.js"

export interface GetProjectWorkflowDataService {
  readonly snapshot: (
    header: string | null,
  ) => Effect.Effect<ProjectSnapshot, Unauthorized | PersistenceError>
  readonly workflows: (
    header: string | null,
  ) => Effect.Effect<
    ProjectSnapshot["workflows"],
    Unauthorized | PersistenceError
  >
  readonly listRuns: (
    header: string | null,
    query: ListRunsQuery,
  ) => Effect.Effect<ListedRunsPage, Unauthorized | PersistenceError>
  readonly timeline: (
    header: string | null,
    runId: string,
  ) => Effect.Effect<
    ReadonlyArray<RunTimelineEvent>,
    Unauthorized | PersistenceError
  >
  readonly related: (
    header: string | null,
    runId: string,
  ) => Effect.Effect<RelatedRuns, Unauthorized | PersistenceError>
  readonly compare: (
    header: string | null,
    runId: string,
  ) => Effect.Effect<RunComparison, Unauthorized | PersistenceError>
  readonly intelligence: (
    header: string | null,
    query: IntelligenceQuery,
  ) => Effect.Effect<WorkflowIntelligence, Unauthorized | PersistenceError>
  readonly snapshotForUser: (
    userId: string,
    projectId?: string,
  ) => Effect.Effect<ProjectSnapshot, Unauthorized | PersistenceError>
  readonly workflowsForUser: (
    userId: string,
    projectId?: string,
  ) => Effect.Effect<
    ProjectSnapshot["workflows"],
    Unauthorized | PersistenceError
  >
  readonly listRunsForUser: (
    userId: string,
    query: ListRunsQuery,
    projectId?: string,
  ) => Effect.Effect<ListedRunsPage, Unauthorized | PersistenceError>
  readonly timelineForUser: (
    userId: string,
    runId: string,
    projectId?: string,
  ) => Effect.Effect<
    ReadonlyArray<RunTimelineEvent>,
    Unauthorized | PersistenceError
  >
  readonly relatedForUser: (
    userId: string,
    runId: string,
    projectId?: string,
  ) => Effect.Effect<RelatedRuns, Unauthorized | PersistenceError>
  readonly compareForUser: (
    userId: string,
    runId: string,
    projectId?: string,
  ) => Effect.Effect<RunComparison, Unauthorized | PersistenceError>
  readonly intelligenceForUser: (
    userId: string,
    query: IntelligenceQuery,
    projectId?: string,
  ) => Effect.Effect<WorkflowIntelligence, Unauthorized | PersistenceError>
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

      const snapshot = Effect.fn("GetProjectWorkflowData.snapshot")(function* (
        header: string | null,
      ) {
        const projectId = yield* authorization.authorize(header, "read")
        return yield* repository.snapshot(projectId)
      })
      const workflows = Effect.fn("GetProjectWorkflowData.workflows")(
        (header: string | null) =>
          snapshot(header).pipe(Effect.map((data) => data.workflows)),
      )
      const listRuns = Effect.fn("GetProjectWorkflowData.listRuns")(function* (
        header: string | null,
        query: ListRunsQuery,
      ) {
        const projectId = yield* authorization.authorize(header, "read")
        return yield* repository.listRuns(projectId, query)
      })
      const timeline = Effect.fn("GetProjectWorkflowData.timeline")(function* (
        header: string | null,
        runId: string,
      ) {
        const projectId = yield* authorization.authorize(header, "read")
        return yield* repository.timeline(projectId, runId)
      })
      const related = Effect.fn("GetProjectWorkflowData.related")(function* (
        header: string | null,
        runId: string,
      ) {
        const projectId = yield* authorization.authorize(header, "read")
        return yield* repository.related(projectId, runId)
      })
      const compare = Effect.fn("GetProjectWorkflowData.compare")(function* (
        header: string | null,
        runId: string,
      ) {
        const projectId = yield* authorization.authorize(header, "read")
        return yield* repository.compare(projectId, runId)
      })
      const intelligence = Effect.fn("GetProjectWorkflowData.intelligence")(
        function* (header: string | null, query: IntelligenceQuery) {
          const projectId = yield* authorization.authorize(header, "read")
          return yield* repository.intelligence(projectId, query)
        },
      )

      const snapshotForUser = Effect.fn(
        "GetProjectWorkflowData.snapshotForUser",
      )(function* (userId: string, requestedProjectId?: string) {
        const projectId = yield* authorization.authorizeUser(
          userId,
          requestedProjectId,
        )
        return yield* repository.snapshot(projectId)
      })
      const workflowsForUser = Effect.fn(
        "GetProjectWorkflowData.workflowsForUser",
      )((userId: string, requestedProjectId?: string) =>
        snapshotForUser(userId, requestedProjectId).pipe(
          Effect.map((data) => data.workflows),
        ),
      )
      const listRunsForUser = Effect.fn(
        "GetProjectWorkflowData.listRunsForUser",
      )(function* (
        userId: string,
        query: ListRunsQuery,
        requestedProjectId?: string,
      ) {
        const projectId = yield* authorization.authorizeUser(
          userId,
          requestedProjectId,
        )
        return yield* repository.listRuns(projectId, query)
      })
      const timelineForUser = Effect.fn(
        "GetProjectWorkflowData.timelineForUser",
      )(function* (userId: string, runId: string, requestedProjectId?: string) {
        const projectId = yield* authorization.authorizeUser(
          userId,
          requestedProjectId,
        )
        return yield* repository.timeline(projectId, runId)
      })
      const relatedForUser = Effect.fn("GetProjectWorkflowData.relatedForUser")(
        function* (userId: string, runId: string, requestedProjectId?: string) {
          const projectId = yield* authorization.authorizeUser(
            userId,
            requestedProjectId,
          )
          return yield* repository.related(projectId, runId)
        },
      )
      const compareForUser = Effect.fn("GetProjectWorkflowData.compareForUser")(
        function* (userId: string, runId: string, requestedProjectId?: string) {
          const projectId = yield* authorization.authorizeUser(
            userId,
            requestedProjectId,
          )
          return yield* repository.compare(projectId, runId)
        },
      )
      const intelligenceForUser = Effect.fn(
        "GetProjectWorkflowData.intelligenceForUser",
      )(function* (
        userId: string,
        query: IntelligenceQuery,
        requestedProjectId?: string,
      ) {
        const projectId = yield* authorization.authorizeUser(
          userId,
          requestedProjectId,
        )
        return yield* repository.intelligence(projectId, query)
      })

      return GetProjectWorkflowData.of({
        snapshot,
        workflows,
        listRuns,
        timeline,
        related,
        compare,
        intelligence,
        snapshotForUser,
        workflowsForUser,
        listRunsForUser,
        timelineForUser,
        relatedForUser,
        compareForUser,
        intelligenceForUser,
      })
    }),
  )
}
