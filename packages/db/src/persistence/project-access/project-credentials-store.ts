import { withOwnerProject } from "./with-owner-project.js"
import { consumePublicReadBudget } from "./writes/consume-public-read-budget.js"
import { Context, Effect, Layer } from "effect"
import {
  DatabaseCancellation,
  Database,
  DatabaseError,
  provideDatabase,
} from "../database.js"
import { browserOriginAllowed } from "./queries/allow-browser-origin.js"
import { authenticateBrowserKey } from "./queries/authenticate-browser-key.js"
import { authenticateKey } from "./queries/authenticate-key.js"
import { getDelegatedReaderProject } from "./queries/get-delegated-reader-project.js"
import { getMemberProject } from "./queries/get-member-project.js"
import { getOnboardingState } from "./queries/get-onboarding-state.js"
import { getProjectForUser } from "./queries/get-project-for-user.js"
import { getWorkspaceForUser } from "./queries/get-workspace-for-user.js"
import { listApiKeys } from "./queries/list-api-keys.js"
import { listBrowserKeys } from "./queries/list-browser-keys.js"
import { listProjectsForUser } from "./queries/list-projects-for-user.js"
import type {
  ApiKeySummary,
  BrowserKeySummary,
  CreatedSecret,
  OnboardingState,
  OnboardingStep,
  ProjectSummary,
} from "./types.js"
import { addProjectMember } from "./writes/add-project-member.js"
import { consumeBrowserQuota } from "./writes/consume-browser-quota.js"
import { consumeCreationQuota } from "./writes/consume-creation-quota.js"
import { createApiKey } from "./writes/create-api-key.js"
import { createBrowserKey } from "./writes/create-browser-key.js"
import { createOwnedProject } from "./writes/create-owned-project.js"
import { createProject } from "./writes/create-project.js"
import { renameProject } from "./writes/rename-project.js"
import { revokeApiKey } from "./writes/revoke-api-key.js"
import { rotateWriteKey } from "./writes/rotate-write-key.js"
import { revokeBrowserKey } from "./writes/revoke-browser-key.js"
import { updateOnboardingState } from "./writes/update-onboarding-state.js"

export type BrowserCredential = {
  readonly id: string
  readonly projectId: string
  readonly allowedOrigins: ReadonlyArray<string>
}

export type {
  ApiKeySummary,
  BrowserKeySummary,
  CreatedSecret,
  ProjectSummary,
} from "./types.js"

export interface ProjectCredentialsStoreService {
  readonly consumePublicReadBudget: (
    scope: string,
    maximum: number,
  ) => Effect.Effect<
    { readonly allowed: boolean; readonly retryAfter: number | null },
    DatabaseError
  >
  readonly consumeCreationQuota: (
    userId: string,
    kind: "project" | "key",
  ) => Effect.Effect<
    { readonly allowed: boolean; readonly retryAfter: number | null },
    DatabaseError
  >
  readonly authenticate: (
    key: string,
    permission: "read" | "write",
  ) => Effect.Effect<string | undefined, DatabaseError>
  readonly authenticateBrowser: (
    key: string,
  ) => Effect.Effect<BrowserCredential | undefined, DatabaseError>
  readonly browserOriginAllowed: (
    origin: string,
  ) => Effect.Effect<boolean, DatabaseError>
  readonly consumeBrowserQuota: (
    keyId: string,
  ) => Effect.Effect<boolean, DatabaseError>
  readonly projectForUser: (
    userId: string,
    role?: "owner",
  ) => Effect.Effect<string | undefined, DatabaseError>
  readonly memberProject: (
    userId: string,
    projectId: string,
    role?: "owner",
  ) => Effect.Effect<string | undefined, DatabaseError>
  readonly delegatedReaderProject: (input: {
    readonly userId: string
    readonly clientId: string
    readonly authorizationCodeId: string
    readonly projectId: string
  }) => Effect.Effect<string | undefined, DatabaseError>
  readonly listProjects: (
    userId: string,
  ) => Effect.Effect<ReadonlyArray<ProjectSummary>, DatabaseError>
  readonly workspaceForUser: (
    userId: string,
  ) => Effect.Effect<string | undefined, DatabaseError>
  readonly onboardingState: (
    userId: string,
  ) => Effect.Effect<OnboardingState | undefined, DatabaseError>
  readonly updateOnboardingState: (
    userId: string,
    step: OnboardingStep,
    completedAt: Date | null,
  ) => Effect.Effect<void, DatabaseError>
  readonly addOwner: (
    userId: string,
    projectId: string,
  ) => Effect.Effect<void, DatabaseError>
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
    DatabaseError
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
    DatabaseError
  >
  readonly renameProject: (
    userId: string,
    projectId: string,
    name: string,
  ) => Effect.Effect<void, DatabaseError>
  readonly listApiKeys: (
    userId: string,
    projectId: string,
  ) => Effect.Effect<ReadonlyArray<ApiKeySummary>, DatabaseError>
  readonly listBrowserKeys: (
    userId: string,
    projectId: string,
  ) => Effect.Effect<ReadonlyArray<BrowserKeySummary>, DatabaseError>
  readonly createApiKey: (
    userId: string,
    projectId: string,
    input: {
      readonly name: string
      readonly permission: "read" | "write"
    },
  ) => Effect.Effect<CreatedSecret, DatabaseError>
  readonly revokeApiKey: (
    userId: string,
    projectId: string,
    keyId: string,
  ) => Effect.Effect<boolean, DatabaseError>
  readonly rotateWriteKey: (
    userId: string,
    projectId: string,
    keyId: string,
  ) => Effect.Effect<CreatedSecret | null, DatabaseError>
  readonly createBrowserKey: (
    userId: string,
    projectId: string,
    input: {
      readonly name: string
      readonly origins: ReadonlyArray<string>
    },
  ) => Effect.Effect<CreatedSecret, DatabaseError>
  readonly revokeBrowserKey: (
    userId: string,
    projectId: string,
    keyId: string,
  ) => Effect.Effect<boolean, DatabaseError>
}
export class ProjectCredentialsStore extends Context.Service<ProjectCredentialsStore>()(
  "@flowmark/db/ProjectCredentialsStore",
  {
    make: Effect.gen(function* () {
      const provide = provideDatabase(
        yield* Database,
        yield* DatabaseCancellation,
      )
      return {
        consumePublicReadBudget: (scope, maximum) =>
          provide(consumePublicReadBudget(scope, maximum)),
        consumeCreationQuota: (userId, kind) =>
          provide(consumeCreationQuota(userId, kind)),
        authenticate: (key, permission) =>
          provide(authenticateKey(key, permission)),
        authenticateBrowser: (key) => provide(authenticateBrowserKey(key)),
        browserOriginAllowed: (origin) => provide(browserOriginAllowed(origin)),
        consumeBrowserQuota: (keyId) => provide(consumeBrowserQuota(keyId)),
        projectForUser: (userId, role) =>
          provide(getProjectForUser(userId, role)),
        memberProject: (userId: string, projectId: string, role?: "owner") =>
          provide(getMemberProject(userId, projectId, role)),
        delegatedReaderProject: (input) =>
          provide(getDelegatedReaderProject(input)),
        listProjects: (userId) => provide(listProjectsForUser(userId)),
        workspaceForUser: (userId) => provide(getWorkspaceForUser(userId)),
        onboardingState: (userId) => provide(getOnboardingState(userId)),
        updateOnboardingState: (userId, step, completedAt) =>
          provide(updateOnboardingState(userId, step, completedAt)),
        addOwner: (userId, projectId) =>
          provide(addProjectMember(userId, projectId)),
        createOwnedProject: (userId, names) =>
          provide(createOwnedProject(userId, names)),
        createProject: (userId, workspaceId, name) =>
          provide(createProject(userId, workspaceId, name)),
        renameProject: (userId, projectId, name) =>
          provide(
            withOwnerProject(userId, projectId, renameProject(projectId, name)),
          ),
        listApiKeys: (userId, projectId) =>
          provide(withOwnerProject(userId, projectId, listApiKeys(projectId))),
        listBrowserKeys: (userId, projectId) =>
          provide(
            withOwnerProject(userId, projectId, listBrowserKeys(projectId)),
          ),
        createApiKey: (userId, projectId, input) =>
          provide(
            withOwnerProject(userId, projectId, createApiKey(projectId, input)),
          ),
        revokeApiKey: (userId, projectId, keyId) =>
          provide(
            withOwnerProject(userId, projectId, revokeApiKey(projectId, keyId)),
          ),
        rotateWriteKey: (userId, projectId, keyId) =>
          provide(
            withOwnerProject(
              userId,
              projectId,
              rotateWriteKey(projectId, keyId),
            ),
          ),
        createBrowserKey: (userId, projectId, input) =>
          provide(
            withOwnerProject(
              userId,
              projectId,
              createBrowserKey(projectId, input),
            ),
          ),
        revokeBrowserKey: (userId, projectId, keyId) =>
          provide(
            withOwnerProject(
              userId,
              projectId,
              revokeBrowserKey(projectId, keyId),
            ),
          ),
      } satisfies ProjectCredentialsStoreService
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make)
}
