import type { RepositoryColdStartStatus } from "@flowmarkdev/core"
import type {
  RecordInstallationDeliveryInput,
  RecordInstallationDeliveryOutcome,
  RecordInstallationPrInput,
  StoredRepositoryInstallation,
  UpsertRepositoryInstallationInput,
} from "@flowmark/db/persistence"
import { Context, type Effect } from "effect"
import type { PersistenceError } from "../../../errors.js"

export class RepositoryInstallationRepository extends Context.Service<
  RepositoryInstallationRepository,
  {
    readonly list: (
      userId: string,
      projectId: string,
    ) => Effect.Effect<
      ReadonlyArray<StoredRepositoryInstallation>,
      PersistenceError
    >
    readonly get: (
      userId: string,
      projectId: string,
      installationId: string,
    ) => Effect.Effect<StoredRepositoryInstallation | null, PersistenceError>
    readonly getForProject: (
      projectId: string,
      installationId: string,
    ) => Effect.Effect<StoredRepositoryInstallation | null, PersistenceError>
    readonly upsert: (
      userId: string,
      input: UpsertRepositoryInstallationInput,
    ) => Effect.Effect<StoredRepositoryInstallation, PersistenceError>
    readonly recordDelivery: (
      input: RecordInstallationDeliveryInput,
    ) => Effect.Effect<RecordInstallationDeliveryOutcome, PersistenceError>
    readonly recordPr: (
      input: RecordInstallationPrInput,
    ) => Effect.Effect<StoredRepositoryInstallation | null, PersistenceError>
    readonly recordVerification: (input: {
      readonly projectId: string
      readonly installationId: string
      readonly runId: string
      readonly coldStartStatus: RepositoryColdStartStatus
    }) => Effect.Effect<StoredRepositoryInstallation | null, PersistenceError>
    readonly revoke: (
      userId: string,
      projectId: string,
      installationId: string,
    ) => Effect.Effect<StoredRepositoryInstallation | null, PersistenceError>
  }
>()("@flowmark/api/RepositoryInstallationRepository") {}
