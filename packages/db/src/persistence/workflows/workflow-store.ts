import { Effect } from "effect"
import type { WorkflowEvent } from "@flowmarkdev/core"
import {
  Database,
  DatabaseError,
  MissingRunError,
  provideDatabase,
} from "../database.js"
import { getProjectSnapshot } from "./queries/get-project-snapshot.js"
import { getRelatedRuns } from "./queries/get-related-runs.js"
import { getRunComparison } from "./queries/get-run-comparison.js"
import {
  getRunTimeline,
  type RunTimelineEvent,
} from "./queries/get-run-timeline.js"
import { appendEvent } from "./writes/append-event.js"
import type { ProjectSnapshot, RelatedRuns, RunComparison } from "./types.js"

export interface WorkflowStoreService {
  readonly append: (
    projectId: string,
    eventId: string,
    event: WorkflowEvent,
  ) => Effect.Effect<void, DatabaseError | MissingRunError>
  readonly snapshot: (
    projectId: string,
  ) => Effect.Effect<ProjectSnapshot, DatabaseError>
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
}

export class WorkflowStore extends Effect.Service<WorkflowStore>()(
  "@flowmark/db/WorkflowStore",
  {
    accessors: true,
    effect: Effect.gen(function* () {
      const provide = provideDatabase(yield* Database)
      return {
        append: (projectId, eventId, event) =>
          provide(appendEvent(projectId, eventId, event)),
        snapshot: (projectId) => provide(getProjectSnapshot(projectId)),
        timeline: (projectId, runId) =>
          provide(getRunTimeline(projectId, runId)),
        related: (projectId, runId) =>
          provide(getRelatedRuns(projectId, runId)),
        compare: (projectId, runId) =>
          provide(getRunComparison(projectId, runId)),
      } satisfies WorkflowStoreService
    }),
  },
) {}
