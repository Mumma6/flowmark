import { Context, Effect, Layer } from "effect"
import type { PersistenceError, Unauthorized } from "../../../errors.js"
import { AuthorizeProject } from "../../project-access/use-cases/authorize-project.js"
import {
  WorkflowRepository,
  type ProjectSnapshot,
  type RelatedRuns,
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
  readonly snapshotForUser: (
    userId: string,
  ) => Effect.Effect<ProjectSnapshot, Unauthorized | PersistenceError>
  readonly workflowsForUser: (
    userId: string,
  ) => Effect.Effect<
    ProjectSnapshot["workflows"],
    Unauthorized | PersistenceError
  >
  readonly timelineForUser: (
    userId: string,
    runId: string,
  ) => Effect.Effect<
    ReadonlyArray<RunTimelineEvent>,
    Unauthorized | PersistenceError
  >
  readonly relatedForUser: (
    userId: string,
    runId: string,
  ) => Effect.Effect<RelatedRuns, Unauthorized | PersistenceError>
}

export class GetProjectWorkflowData extends Context.Tag(
  "@flowmark/api/GetProjectWorkflowData",
)<GetProjectWorkflowData, GetProjectWorkflowDataService>() {
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

      const snapshotForUser = Effect.fn(
        "GetProjectWorkflowData.snapshotForUser",
      )(function* (userId: string) {
        const projectId = yield* authorization.authorizeUser(userId)
        return yield* repository.snapshot(projectId)
      })
      const workflowsForUser = Effect.fn(
        "GetProjectWorkflowData.workflowsForUser",
      )((userId: string) =>
        snapshotForUser(userId).pipe(Effect.map((data) => data.workflows)),
      )
      const timelineForUser = Effect.fn(
        "GetProjectWorkflowData.timelineForUser",
      )(function* (userId: string, runId: string) {
        const projectId = yield* authorization.authorizeUser(userId)
        return yield* repository.timeline(projectId, runId)
      })
      const relatedForUser = Effect.fn("GetProjectWorkflowData.relatedForUser")(
        function* (userId: string, runId: string) {
          const projectId = yield* authorization.authorizeUser(userId)
          return yield* repository.related(projectId, runId)
        },
      )

      return GetProjectWorkflowData.of({
        snapshot,
        workflows,
        timeline,
        related,
        snapshotForUser,
        workflowsForUser,
        timelineForUser,
        relatedForUser,
      })
    }),
  )
}
