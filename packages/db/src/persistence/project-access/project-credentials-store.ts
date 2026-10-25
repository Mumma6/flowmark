import { Effect } from "effect"
import { Database, DatabaseError, provideDatabase } from "../database.js"
import { browserOriginAllowed } from "./queries/allow-browser-origin.js"
import { authenticateBrowserKey } from "./queries/authenticate-browser-key.js"
import { authenticateKey } from "./queries/authenticate-key.js"
import { getProjectForUser } from "./queries/get-project-for-user.js"
import { addProjectMember } from "./writes/add-project-member.js"
import { consumeBrowserQuota } from "./writes/consume-browser-quota.js"
import { createOwnedProject } from "./writes/create-owned-project.js"

export type BrowserCredential = {
  readonly id: string
  readonly projectId: string
  readonly allowedOrigins: ReadonlyArray<string>
}

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
        addOwner: (userId, projectId) =>
          provide(addProjectMember(userId, projectId)),
        createOwnedProject: (userId, names) =>
          provide(createOwnedProject(userId, names)),
      } satisfies ProjectCredentialsStoreService
    }),
  },
) {}
