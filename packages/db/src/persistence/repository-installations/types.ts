import type {
  RepositoryColdStartStatus,
  RepositoryCollectionPolicy,
  RepositoryHost,
  RepositoryInstallationStatus,
  RepositoryRuntime,
} from "@flowmarkdev/core"

export type StoredRepositoryInstallation = Readonly<{
  readonly id: string
  readonly projectId: string
  readonly bindingId: string
  readonly host: RepositoryHost
  readonly runtime: RepositoryRuntime
  readonly repository: string
  readonly service: string
  readonly environment: string
  readonly externalInstallationId: string
  readonly policy: RepositoryCollectionPolicy
  readonly status: RepositoryInstallationStatus
  readonly coldStartStatus: RepositoryColdStartStatus
  readonly prBranch: string | null
  readonly prNumber: number | null
  readonly prUrl: string | null
  readonly prHeadSha: string | null
  readonly verifiedRunId: string | null
  readonly verifiedAt: Date | null
  readonly delegatedAuthorizationCodeId: string | null
  readonly delegatedClientId: string | null
  readonly delegatedUserId: string | null
  readonly lastEventAt: Date | null
  readonly revokedAt: Date | null
  readonly createdAt: Date
  readonly updatedAt: Date
}>

export type UpsertRepositoryInstallationInput = Readonly<{
  readonly projectId: string
  readonly bindingId: string
  readonly host: RepositoryHost
  readonly runtime: RepositoryRuntime
  readonly repository: string
  readonly service: string
  readonly environment: string
  readonly externalInstallationId: string
  readonly policy: RepositoryCollectionPolicy
  readonly delegatedGrantFamily?: Readonly<{
    readonly authorizationCodeId: string
    readonly clientId: string
  }>
}>

export type RecordInstallationPrInput = Readonly<{
  readonly projectId: string
  readonly installationId: string
  readonly branch: string
  readonly number: number
  readonly url: string
  readonly headSha: string
}>

export type RecordInstallationDeliveryInput = Readonly<{
  readonly host: RepositoryHost
  readonly externalInstallationId: string
  readonly repository: string
  readonly deliveryId: string
  readonly action: string
  readonly sentAt: Date
  readonly revoke: boolean
}>

export type RecordInstallationDeliveryOutcome =
  | { readonly status: "not-found" }
  | {
      readonly status: "foreign-repository"
      readonly expectedRepository: string
    }
  | {
      readonly status: "revoked"
      readonly installation: StoredRepositoryInstallation
    }
  | {
      readonly status: "stale"
      readonly installation: StoredRepositoryInstallation
    }
  | {
      readonly status: "duplicate"
      readonly installation: StoredRepositoryInstallation
    }
  | {
      readonly status: "accepted"
      readonly installation: StoredRepositoryInstallation
    }
  | {
      readonly status: "revoked-now"
      readonly installation: StoredRepositoryInstallation
    }
