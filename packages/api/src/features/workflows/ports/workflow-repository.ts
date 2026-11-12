import type { AppendDisposition, WorkflowEvent } from "@flowmarkdev/core"
import { Context, type Effect, type Redacted } from "effect"
import type {
  PersistenceError,
  RunNotFound,
  InvalidInput,
} from "../../../errors.js"
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
    credential?: {
      readonly kind: "api" | "browser"
      readonly key: Redacted.Redacted<string>
    },
  ) => Effect.Effect<
    AppendDisposition,
    PersistenceError | RunNotFound | InvalidInput
  >
}
export class WorkflowRepository extends Context.Service<
  WorkflowRepository,
  WorkflowRepositoryService
>()("@flowmark/api/WorkflowRepository") {}
