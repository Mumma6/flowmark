import { Context, Redacted, type Effect } from "effect"
import type { PersistenceError } from "../../../errors.js"

export interface BrowserCredential {
  readonly id: string
  readonly projectId: string
  readonly allowedOrigins: ReadonlyArray<string>
}

export interface ProjectSummary {
  readonly id: string
  readonly name: string
  readonly createdAt: string
}

export type OnboardingStep =
  "project" | "key" | "install" | "instrument" | "run"

export interface OnboardingState {
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
  ) => Effect.Effect<string | undefined, PersistenceError>
  readonly memberProject: (
    userId: string,
    projectId: string,
  ) => Effect.Effect<string | undefined, PersistenceError>
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
  readonly addOwner: (
    userId: string,
    projectId: string,
  ) => Effect.Effect<void, PersistenceError>
  readonly createOwnedProject: (
    userId: string,
    names: { readonly workspace: string; readonly project: string },
  ) => Effect.Effect<
    {
      readonly projectId: string
      readonly writeKey: string
      readonly readKey: string
    },
    PersistenceError
  >
  readonly createProject: (
    userId: string,
    workspaceId: string,
    name: string,
  ) => Effect.Effect<
    { readonly projectId: string; readonly writeKey: CreatedSecret },
    PersistenceError
  >
  readonly renameProject: (
    projectId: string,
    name: string,
  ) => Effect.Effect<void, PersistenceError>
  readonly listApiKeys: (
    projectId: string,
  ) => Effect.Effect<ReadonlyArray<ApiKeySummary>, PersistenceError>
  readonly listBrowserKeys: (
    projectId: string,
  ) => Effect.Effect<ReadonlyArray<BrowserKeySummary>, PersistenceError>
  readonly createApiKey: (
    projectId: string,
    input: { readonly name: string; readonly permission: "read" | "write" },
  ) => Effect.Effect<CreatedSecret, PersistenceError>
  readonly revokeApiKey: (
    projectId: string,
    keyId: string,
  ) => Effect.Effect<boolean, PersistenceError>
  readonly createBrowserKey: (
    projectId: string,
    input: { readonly name: string; readonly origins: ReadonlyArray<string> },
  ) => Effect.Effect<CreatedSecret, PersistenceError>
  readonly revokeBrowserKey: (
    projectId: string,
    keyId: string,
  ) => Effect.Effect<boolean, PersistenceError>
}

export class ProjectCredentials extends Context.Tag(
  "@flowmark/api/ProjectCredentials",
)<ProjectCredentials, ProjectCredentialsService>() {}
