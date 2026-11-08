import { AgentConsent } from "./features/project-access/use-cases/agent-consent.js"
import { AgentConsentRepositoryLive } from "./features/project-access/adapters/agent-consent.js"
import { ManageResultDeclarations } from "./features/result-declarations/use-cases/manage-result-declarations.js"
import { ResultDeclarationsLive } from "./features/result-declarations/adapters/result-declarations.js"
import { ResultDeclarationStore } from "@flowmark/db/persistence"
import { Effect, Layer } from "effect"
import { ApiSettings } from "./config.js"
import { AuthorizeProject } from "./features/project-access/use-cases/authorize-project.js"
import { AgentAccessLive } from "./features/project-access/adapters/agent-access.js"
import { AgentAccess } from "./features/project-access/ports/agent-access.js"
import { ManageProject } from "./features/project-access/use-cases/manage-project.js"
import { Onboarding } from "./features/project-access/use-cases/onboarding.js"
import { IngestWorkflowEvents } from "./features/workflows/use-cases/ingest-events.js"
import { GetProjectWorkflowData } from "./features/workflows/use-cases/get-project-workflow-data.js"
import { IngestBrowserWorkflowEvents } from "./features/workflows/use-cases/ingest-browser-events.js"
import {
  AgentAccessStore,
  ProjectCredentialsStore,
  WorkflowStore,
} from "@flowmark/db/persistence"
import { DatabaseLive } from "./adapters/database.js"
import { WorkflowRepositoryLive } from "./features/workflows/adapters/workflow-repository.js"
import { ProjectCredentialsLive } from "./features/project-access/adapters/project-credentials.js"
import { GetMcpAgentConnectionLive } from "./features/project-access/use-cases/get-mcp-agent-connection.js"
import { GetMcpAgentConnection } from "./features/project-access/use-cases/get-mcp-agent-connection.js"

const persistence = Layer.mergeAll(
  ResultDeclarationStore.layer,
  WorkflowStore.layer,
  ProjectCredentialsStore.layer,
  AgentAccessStore.layer,
).pipe(Layer.provide(DatabaseLive))
const databaseAdapters = Layer.mergeAll(
  ResultDeclarationsLive,
  AgentConsentRepositoryLive,
  WorkflowRepositoryLive,
  ProjectCredentialsLive,
).pipe(Layer.provide(persistence))
const dependencies = AuthorizeProject.layer.pipe(
  Layer.provideMerge(databaseAdapters),
)
const agentAccessAdapter = Layer.mergeAll(
  AgentAccessLive,
  GetMcpAgentConnectionLive,
).pipe(Layer.provide(persistence))

export const ApiLive = Layer.mergeAll(
  AgentConsent.layer,
  ManageResultDeclarations.layer,
  IngestWorkflowEvents.layer,
  GetProjectWorkflowData.layer,
  IngestBrowserWorkflowEvents.layer,
  ManageProject.layer,
  Onboarding.layer,
).pipe(
  Layer.provideMerge(agentAccessAdapter),
  Layer.provide(dependencies),
  Layer.provide(ApiSettings.layer),
)

/** Request boundary: acquire dependencies, execute once, then release the scope. */
export function runApi<A, E>(
  operation: Effect.Effect<
    A,
    E,
    | AgentAccess
    | AgentConsent
    | ManageResultDeclarations
    | IngestWorkflowEvents
    | GetProjectWorkflowData
    | IngestBrowserWorkflowEvents
    | ManageProject
    | Onboarding
    | GetMcpAgentConnection
  >,
  signal?: AbortSignal,
) {
  return Effect.runPromiseExit(operation.pipe(Effect.provide(ApiLive)), {
    signal,
  })
}

export { logFailure } from "./diagnostics.js"
