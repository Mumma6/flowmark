import type { AppendDisposition, WorkflowEvent } from "@flowmarkdev/core"
import { Context, type Effect } from "effect"
import type { PersistenceError, RunNotFound } from "../../../errors.js"
import type {
  WorkflowRepositoryRuns,
  WorkflowRepositoryAnalytics,
  WorkflowRepositoryDiscovery,
} from "./workflow-read-capabilities.ts"
export interface WorkflowRepositoryService
  extends
    WorkflowRepositoryRuns,
    WorkflowRepositoryAnalytics,
    WorkflowRepositoryDiscovery {
  readonly append: (
    projectId: string,
    eventId: string,
    event: WorkflowEvent,
  ) => Effect.Effect<AppendDisposition, PersistenceError | RunNotFound>
}
export class WorkflowRepository extends Context.Service<
  WorkflowRepository,
  WorkflowRepositoryService
>()("@flowmark/api/WorkflowRepository") {}
