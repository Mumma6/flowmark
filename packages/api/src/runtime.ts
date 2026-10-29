import { Effect, Layer } from "effect"
import { ApiSettings } from "./config.js"
import { AuthorizeProject } from "./features/project-access/use-cases/authorize-project.js"
import { ManageProject } from "./features/project-access/use-cases/manage-project.js"
import { Onboarding } from "./features/project-access/use-cases/onboarding.js"
import { RegisterOwner } from "./features/project-access/use-cases/register-owner.js"
import { IngestWorkflowEvents } from "./features/workflows/use-cases/ingest-events.js"
import { GetProjectWorkflowData } from "./features/workflows/use-cases/get-project-workflow-data.js"
import { IngestBrowserWorkflowEvents } from "./features/workflows/use-cases/ingest-browser-events.js"
import {
  ProjectCredentialsStore,
  WorkflowStore,
} from "@flowmark/db/persistence"
import { DatabaseLive } from "./adapters/database.js"
import { WorkflowRepositoryLive } from "./features/workflows/adapters/workflow-repository.js"
import { ProjectCredentialsLive } from "./features/project-access/adapters/project-credentials.js"

const persistence = Layer.mergeAll(
  WorkflowStore.Default,
  ProjectCredentialsStore.Default,
).pipe(Layer.provide(DatabaseLive))
const databaseAdapters = Layer.mergeAll(
  WorkflowRepositoryLive,
  ProjectCredentialsLive,
).pipe(Layer.provide(persistence))
const dependencies = AuthorizeProject.layer.pipe(
  Layer.provideMerge(databaseAdapters),
)

export const ApiLive = Layer.mergeAll(
  IngestWorkflowEvents.layer,
  GetProjectWorkflowData.layer,
  IngestBrowserWorkflowEvents.layer,
  RegisterOwner.layer,
  ManageProject.layer,
  Onboarding.layer,
).pipe(Layer.provide(dependencies), Layer.provide(ApiSettings.layer))

/** Request boundary: acquire dependencies, execute once, then release the scope. */
export function runApi<A, E>(
  operation: Effect.Effect<
    A,
    E,
    | IngestWorkflowEvents
    | GetProjectWorkflowData
    | IngestBrowserWorkflowEvents
    | RegisterOwner
    | ManageProject
    | Onboarding
  >,
  signal?: AbortSignal,
) {
  return Effect.runPromiseExit(operation.pipe(Effect.provide(ApiLive)), {
    signal,
  })
}

export { logFailure } from "./diagnostics.js"
