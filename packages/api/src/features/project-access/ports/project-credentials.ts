import { Context, Redacted, type Effect } from "effect"
import type { PersistenceError } from "../../../errors.js"

export interface BrowserCredential {
  readonly id: string
  readonly projectId: string
  readonly allowedOrigins: ReadonlyArray<string>
}

export interface ProjectSummary {
  readonly role?: "owner" | "viewer" | "business"
  readonly id: string
  readonly name: string
  readonly createdAt: string
}

export type OnboardingStep =
  "project" | "key" | "install" | "instrument" | "run"

export interface OnboardingState {
  readonly sharedAccess?: boolean
  readonly step: OnboardingStep
  readonly completedAt: string | null
}

export interface ApiKeySummary {
  readonly id: string
  readonly name: string
  readonly prefix: string
  readonly permission: "read" | "write"
  readonly createdAt: string
}

export interface BrowserKeySummary {
  readonly id: string
  readonly name: string
  readonly prefix: string
  readonly allowedOrigins: ReadonlyArray<string>
  readonly createdAt: string
}

export interface CreatedSecret {
  readonly id: string
  readonly name: string
  readonly prefix: string
  readonly secret: string
}

export interface ProjectCredentialsService {
  readonly consumeCreationQuota: (
    userId: string,
    kind: "project" | "key",
  ) => Effect.Effect<
    { readonly allowed: boolean; readonly retryAfter: number | null },
    PersistenceError
  >
  readonly authenticateBrowser: (
    key: Redacted.Redacted<string>,
  ) => Effect.Effect<BrowserCredential | undefined, PersistenceError>
  readonly browserOriginAllowed: (
    origin: string,
  ) => Effect.Effect<boolean, PersistenceError>
  readonly consumeBrowserQuota: (
    keyId: string,
  ) => Effect.Effect<boolean, PersistenceError>
  readonly authenticate: (
    key: Redacted.Redacted<string>,
    permission: "read" | "write",
  ) => Effect.Effect<string | undefined, PersistenceError>
  readonly projectForUser: (
    userId: string,
    role?: "owner" | "diagnostic",
  ) => Effect.Effect<string | undefined, PersistenceError>
  readonly memberProject: (
    userId: string,
    projectId: string,
    role?: "owner" | "diagnostic",
  ) => Effect.Effect<string | undefined, PersistenceError>
  readonly delegatedReaderProject: (input: {
    readonly userId: string
    readonly clientId: string
    readonly authorizationCodeId: string
    readonly projectId: string
  }) => Effect.Effect<string | undefined, PersistenceError>
  readonly listProjects: (
    userId: string,
  ) => Effect.Effect<ReadonlyArray<ProjectSummary>, PersistenceError>
  readonly workspaceForUser: (
    userId: string,
  ) => Effect.Effect<string | undefined, PersistenceError>
  readonly onboardingState: (
    userId: string,
  ) => Effect.Effect<OnboardingState | undefined, PersistenceError>
  readonly updateOnboardingState: (
    userId: string,
    step: OnboardingStep,
    completedAt: Date | null,
  ) => Effect.Effect<void, PersistenceError>
  readonly createOwnedProject: (
    userId: string,
    names: {
      readonly workspace: string
      readonly project: string
    },
  ) => Effect.Effect<
    {
      readonly projectId: string
      readonly createdAt: string
      readonly writeKey: CreatedSecret
    },
    PersistenceError
  >
  readonly createProject: (
    userId: string,
    workspaceId: string,
    name: string,
  ) => Effect.Effect<
    {
      readonly projectId: string
      readonly createdAt: string
      readonly writeKey: CreatedSecret
    },
    PersistenceError
  >
  readonly renameProject: (
    userId: string,
    projectId: string,
    name: string,
  ) => Effect.Effect<void, PersistenceError>
  readonly listApiKeys: (
    userId: string,
    projectId: string,
  ) => Effect.Effect<ReadonlyArray<ApiKeySummary>, PersistenceError>
  readonly listBrowserKeys: (
    userId: string,
    projectId: string,
  ) => Effect.Effect<ReadonlyArray<BrowserKeySummary>, PersistenceError>
  readonly createApiKey: (
    userId: string,
    projectId: string,
    input: {
      readonly name: string
      readonly permission: "read" | "write"
    },
  ) => Effect.Effect<CreatedSecret, PersistenceError>
  readonly revokeApiKey: (
    userId: string,
    projectId: string,
    keyId: string,
  ) => Effect.Effect<boolean, PersistenceError>
  readonly rotateWriteKey: (
    userId: string,
    projectId: string,
    keyId: string,
  ) => Effect.Effect<CreatedSecret | null, PersistenceError>
  readonly createBrowserKey: (
    userId: string,
    projectId: string,
    input: {
      readonly name: string
      readonly origins: ReadonlyArray<string>
    },
  ) => Effect.Effect<CreatedSecret, PersistenceError>
  readonly revokeBrowserKey: (
    userId: string,
    projectId: string,
    keyId: string,
  ) => Effect.Effect<boolean, PersistenceError>
}
export class ProjectCredentials extends Context.Service<
  ProjectCredentials,
  ProjectCredentialsService
>()("@flowmark/api/ProjectCredentials") {}
