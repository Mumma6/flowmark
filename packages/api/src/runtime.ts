import { EvidenceCaptureStore } from "@flowmark/db/persistence"
import { EvidenceEngine } from "@flowmark/evidence-engine"
import {
  EvidenceCapturesLive,
  EvidenceCaptureAdmissionLive,
} from "./features/evidence-captures/adapters/evidence-captures.js"
import { ManageEvidenceCaptures } from "./features/evidence-captures/use-cases/manage-evidence-captures.js"
import { SharedInvestigationStore } from "@flowmark/db/persistence"
import { SharedInvestigationsLive } from "./features/shared-investigations/adapters/shared-investigations.js"
import { ManageSharedInvestigations } from "./features/shared-investigations/use-cases/manage-shared-investigations.js"
import { BusinessEvidenceStore } from "@flowmark/db/persistence"
import { BusinessEvidenceRepositoryLive } from "./features/business-evidence/adapters/business-evidence.js"
import { GetBusinessEvidence } from "./features/business-evidence/use-cases/business-evidence.js"
import { ProjectSharingStore } from "@flowmark/db/persistence"
import { ProjectSharingRepositoryLive } from "./features/project-sharing/adapters/project-sharing.js"
import { ManageProjectSharing } from "./features/project-sharing/use-cases/manage-project-sharing.js"
import { AccountLifecycleStore } from "@flowmark/db/persistence"
import { AccountLifecycleLive } from "./features/data-lifecycle/adapters/account-lifecycle.js"
import { ManageAccountLifecycle } from "./features/data-lifecycle/use-cases/manage-account-lifecycle.js"
import { ManageDataLifecycle } from "./features/data-lifecycle/use-cases/manage-data-lifecycle.js"
import { DataLifecycleLive } from "./features/data-lifecycle/adapters/data-lifecycle.js"
import { DataLifecycleStore } from "@flowmark/db/persistence"
import { ManageInvestigations } from "./features/investigations/use-cases/manage-investigations.js"
import { InvestigationsLive } from "./features/investigations/adapters/investigations.js"
import { InvestigationStore } from "@flowmark/db/persistence"
import { AuthorizeAgentRead } from "./features/project-access/use-cases/authorize-agent-read.js"
import { DelegatedAccessRepositoryLive } from "./features/project-access/adapters/delegated-access-repository.js"
import { ReadPublicPeriod } from "./features/public-reads/use-cases/read-period.js"
import { ReadPublicRun } from "./features/public-reads/use-cases/read-run.js"
import { PublicReadAdmissionLive } from "./features/public-reads/adapters/public-read-admission.js"
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
  SharedInvestigationStore.layer,
  EvidenceCaptureStore.layer,
  BusinessEvidenceStore.layer,
  ProjectSharingStore.layer,
  AccountLifecycleStore.layer,
  DataLifecycleStore.layer,
  InvestigationStore.layer,
  ResultDeclarationStore.layer,
  WorkflowStore.layer,
  ProjectCredentialsStore.layer,
  AgentAccessStore.layer,
).pipe(Layer.provide(DatabaseLive))
const databaseAdapters = Layer.mergeAll(
  SharedInvestigationsLive,
  EvidenceCapturesLive,
  EvidenceCaptureAdmissionLive,
  BusinessEvidenceRepositoryLive,
  ProjectSharingRepositoryLive,
  AccountLifecycleLive,
  DataLifecycleLive,
  InvestigationsLive,
  ResultDeclarationsLive,
  AgentConsentRepositoryLive,
  WorkflowRepositoryLive,
  ProjectCredentialsLive,
).pipe(Layer.provide(persistence))
const readAdmission = PublicReadAdmissionLive.pipe(Layer.provide(persistence))

const dependencies = AuthorizeProject.layer.pipe(
  Layer.provideMerge(databaseAdapters),
)
const agentAccessAdapter = Layer.mergeAll(
  AgentAccessLive,
  GetMcpAgentConnectionLive,
  AuthorizeAgentRead.layer,
).pipe(
  Layer.provide(DelegatedAccessRepositoryLive.pipe(Layer.provide(persistence))),
  Layer.provide(persistence),
)

export const ApiLive = Layer.mergeAll(
  ManageSharedInvestigations.layer,
  ManageEvidenceCaptures.layer,
  GetBusinessEvidence.layer,
  ManageProjectSharing.layer,
  ManageAccountLifecycle.layer,
  ManageDataLifecycle.layer,
  ManageInvestigations.layer,
  ReadPublicRun.layer,
  ReadPublicPeriod.layer,
  AgentConsent.layer,
  ManageResultDeclarations.layer,
  IngestWorkflowEvents.layer,
  GetProjectWorkflowData.layer,
  IngestBrowserWorkflowEvents.layer,
  ManageProject.layer,
  Onboarding.layer,
).pipe(
  Layer.provide(readAdmission),
  Layer.provideMerge(agentAccessAdapter),
  Layer.provide(dependencies),
  Layer.provide(ApiSettings.layer),
  Layer.provide(EvidenceEngine.layer),
)

/** Request boundary: acquire dependencies, execute once, then release the scope. */
export function runApi<A, E>(
  operation: Effect.Effect<
    A,
    E,
    | ManageSharedInvestigations
    | ManageEvidenceCaptures
    | GetBusinessEvidence
    | ManageProjectSharing
    | ManageAccountLifecycle
    | ManageDataLifecycle
    | ManageInvestigations
    | AuthorizeAgentRead
    | ReadPublicPeriod
    | ReadPublicRun
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
