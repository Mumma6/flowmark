import { Effect } from "effect"
import { Database, DatabaseError, provideDatabase } from "../database.js"
import { browserOriginAllowed } from "./queries/allow-browser-origin.js"
import { authenticateBrowserKey } from "./queries/authenticate-browser-key.js"
import { authenticateKey } from "./queries/authenticate-key.js"
import { getMemberProject } from "./queries/get-member-project.js"
import { getProjectForUser } from "./queries/get-project-for-user.js"
import { getWorkspaceForUser } from "./queries/get-workspace-for-user.js"
import { listApiKeys } from "./queries/list-api-keys.js"
import { listBrowserKeys } from "./queries/list-browser-keys.js"
import { listProjectsForUser } from "./queries/list-projects-for-user.js"
import type {
  ApiKeySummary,
  BrowserKeySummary,
  CreatedSecret,
  ProjectSummary,
} from "./types.js"
import { addProjectMember } from "./writes/add-project-member.js"
import { consumeBrowserQuota } from "./writes/consume-browser-quota.js"
import { createApiKey } from "./writes/create-api-key.js"
import { createBrowserKey } from "./writes/create-browser-key.js"
import { createOwnedProject } from "./writes/create-owned-project.js"
import { createProject } from "./writes/create-project.js"
import { renameProject } from "./writes/rename-project.js"
import { revokeApiKey } from "./writes/revoke-api-key.js"
import { revokeBrowserKey } from "./writes/revoke-browser-key.js"

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
  ) => Effect.Effect<string | undefined, DatabaseError>
  readonly memberProject: (
    userId: string,
    projectId: string,
  ) => Effect.Effect<string | undefined, DatabaseError>
  readonly listProjects: (
    userId: string,
  ) => Effect.Effect<ReadonlyArray<ProjectSummary>, DatabaseError>
  readonly workspaceForUser: (
    userId: string,
  ) => Effect.Effect<string | undefined, DatabaseError>
  readonly addOwner: (
    userId: string,
    projectId: string,
  ) => Effect.Effect<void, DatabaseError>
  readonly createOwnedProject: (
    userId: string,
    names: { readonly workspace: string; readonly project: string },
  ) => Effect.Effect<
    {
      readonly projectId: string
      readonly writeKey: string
      readonly readKey: string
    },
    DatabaseError
  >
  readonly createProject: (
    userId: string,
    workspaceId: string,
    name: string,
  ) => Effect.Effect<
    { readonly projectId: string; readonly writeKey: CreatedSecret },
    DatabaseError
  >
  readonly renameProject: (
    projectId: string,
    name: string,
  ) => Effect.Effect<void, DatabaseError>
  readonly listApiKeys: (
    projectId: string,
  ) => Effect.Effect<ReadonlyArray<ApiKeySummary>, DatabaseError>
  readonly listBrowserKeys: (
    projectId: string,
  ) => Effect.Effect<ReadonlyArray<BrowserKeySummary>, DatabaseError>
  readonly createApiKey: (
    projectId: string,
    input: { readonly name: string; readonly permission: "read" | "write" },
  ) => Effect.Effect<CreatedSecret, DatabaseError>
  readonly revokeApiKey: (
    projectId: string,
    keyId: string,
  ) => Effect.Effect<boolean, DatabaseError>
  readonly createBrowserKey: (
    projectId: string,
    input: { readonly name: string; readonly origins: ReadonlyArray<string> },
  ) => Effect.Effect<CreatedSecret, DatabaseError>
  readonly revokeBrowserKey: (
    projectId: string,
    keyId: string,
  ) => Effect.Effect<boolean, DatabaseError>
}

export class ProjectCredentialsStore extends Effect.Service<ProjectCredentialsStore>()(
  "@flowmark/db/ProjectCredentialsStore",
  {
    accessors: true,
    effect: Effect.gen(function* () {
      const provide = provideDatabase(yield* Database)
      return {
        authenticate: (key, permission) =>
          provide(authenticateKey(key, permission)),
        authenticateBrowser: (key) => provide(authenticateBrowserKey(key)),
        browserOriginAllowed: (origin) => provide(browserOriginAllowed(origin)),
        consumeBrowserQuota: (keyId) => provide(consumeBrowserQuota(keyId)),
        projectForUser: (userId) => provide(getProjectForUser(userId)),
        memberProject: (userId, projectId) =>
          provide(getMemberProject(userId, projectId)),
        listProjects: (userId) => provide(listProjectsForUser(userId)),
        workspaceForUser: (userId) => provide(getWorkspaceForUser(userId)),
        addOwner: (userId, projectId) =>
          provide(addProjectMember(userId, projectId)),
        createOwnedProject: (userId, names) =>
          provide(createOwnedProject(userId, names)),
        createProject: (userId, workspaceId, name) =>
          provide(createProject(userId, workspaceId, name)),
        renameProject: (projectId, name) =>
          provide(renameProject(projectId, name)),
        listApiKeys: (projectId) => provide(listApiKeys(projectId)),
        listBrowserKeys: (projectId) => provide(listBrowserKeys(projectId)),
        createApiKey: (projectId, input) =>
          provide(createApiKey(projectId, input)),
        revokeApiKey: (projectId, keyId) =>
          provide(revokeApiKey(projectId, keyId)),
        createBrowserKey: (projectId, input) =>
          provide(createBrowserKey(projectId, input)),
        revokeBrowserKey: (projectId, keyId) =>
          provide(revokeBrowserKey(projectId, keyId)),
      } satisfies ProjectCredentialsStoreService
    }),
  },
) {}
