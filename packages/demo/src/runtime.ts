import { Layer, Redacted } from "effect"
import type { FlowmarkDatabase } from "@flowmark/db"
import {
  Database,
  ProjectCredentialsStore,
  ResultDeclarationStore,
  WorkflowStore,
} from "@flowmark/db/persistence"
import {
  ApiSettings,
  AuthorizeProject,
  IngestWorkflowEvents,
  ManageProject,
  ManageResultDeclarations,
  ProjectCredentialsLive,
  ResultDeclarationsLive,
  WorkflowRepositoryLive,
} from "@flowmark/api"

/** Reuse application authorization, validation and persistence inside the fixture transaction. */
export const fixtureApi = (
  db: FlowmarkDatabase,
): Layer.Layer<
  | ManageProject
  | ManageResultDeclarations
  | IngestWorkflowEvents
  | AuthorizeProject
> => {
  const stores = Layer.mergeAll(
    ProjectCredentialsStore.layer,
    ResultDeclarationStore.layer,
    WorkflowStore.layer,
  ).pipe(Layer.provide(Layer.succeed(Database, db)))
  const adapters = Layer.mergeAll(
    ProjectCredentialsLive,
    ResultDeclarationsLive,
    WorkflowRepositoryLive,
  ).pipe(Layer.provide(stores))
  const dependencies = AuthorizeProject.layer.pipe(
    Layer.provideMerge(adapters),
    Layer.provide(
      Layer.succeed(ApiSettings, {
        demoMode: false,
        databaseUrl: Redacted.make("fixture-transaction"),
      }),
    ),
  )
  return Layer.mergeAll(
    ManageProject.layer,
    ManageResultDeclarations.layer,
    IngestWorkflowEvents.layer,
  ).pipe(Layer.provideMerge(dependencies))
}
