import { Effect, Layer, Redacted } from "effect"
import { ProjectCredentialsStore } from "@flowmark/db/persistence"
import { persist } from "../../../adapters/persistence-error.js"
import { ProjectCredentials } from "../ports/project-credentials.js"

export const ProjectCredentialsLive = Layer.effect(
  ProjectCredentials,
  Effect.gen(function* () {
    const store = yield* ProjectCredentialsStore
    return ProjectCredentials.of({
      authenticateBrowser: Effect.fn(
        "ProjectCredentialsLive.authenticateBrowser",
      )((key) => persist(store.authenticateBrowser(Redacted.value(key)))),
      browserOriginAllowed: Effect.fn(
        "ProjectCredentialsLive.browserOriginAllowed",
      )((origin) => persist(store.browserOriginAllowed(origin))),
      consumeBrowserQuota: Effect.fn(
        "ProjectCredentialsLive.consumeBrowserQuota",
      )((keyId) => persist(store.consumeBrowserQuota(keyId))),
      authenticate: Effect.fn("ProjectCredentialsLive.authenticate")(
        (key, permission) =>
          persist(store.authenticate(Redacted.value(key), permission)),
      ),
      projectForUser: Effect.fn("ProjectCredentialsLive.projectForUser")(
        (userId) => persist(store.projectForUser(userId)),
      ),
      memberProject: Effect.fn("ProjectCredentialsLive.memberProject")(
        (userId, projectId) => persist(store.memberProject(userId, projectId)),
      ),
      listProjects: Effect.fn("ProjectCredentialsLive.listProjects")((userId) =>
        persist(store.listProjects(userId)),
      ),
      workspaceForUser: Effect.fn("ProjectCredentialsLive.workspaceForUser")(
        (userId) => persist(store.workspaceForUser(userId)),
      ),
      onboardingState: Effect.fn("ProjectCredentialsLive.onboardingState")(
        (userId) => persist(store.onboardingState(userId)),
      ),
      updateOnboardingState: Effect.fn(
        "ProjectCredentialsLive.updateOnboardingState",
      )((userId, step, completedAt) =>
        persist(store.updateOnboardingState(userId, step, completedAt)),
      ),
      createOwnedProject: Effect.fn(
        "ProjectCredentialsLive.createOwnedProject",
      )((userId, names) => persist(store.createOwnedProject(userId, names))),
      createProject: Effect.fn("ProjectCredentialsLive.createProject")(
        (userId, workspaceId, name) =>
          persist(store.createProject(userId, workspaceId, name)),
      ),
      renameProject: Effect.fn("ProjectCredentialsLive.renameProject")(
        (projectId, name) => persist(store.renameProject(projectId, name)),
      ),
      listApiKeys: Effect.fn("ProjectCredentialsLive.listApiKeys")(
        (projectId) => persist(store.listApiKeys(projectId)),
      ),
      listBrowserKeys: Effect.fn("ProjectCredentialsLive.listBrowserKeys")(
        (projectId) => persist(store.listBrowserKeys(projectId)),
      ),
      createApiKey: Effect.fn("ProjectCredentialsLive.createApiKey")(
        (projectId, input) => persist(store.createApiKey(projectId, input)),
      ),
      revokeApiKey: Effect.fn("ProjectCredentialsLive.revokeApiKey")(
        (projectId, keyId) => persist(store.revokeApiKey(projectId, keyId)),
      ),
      rotateWriteKey: Effect.fn("ProjectCredentialsLive.rotateWriteKey")(
        (projectId, keyId) => persist(store.rotateWriteKey(projectId, keyId)),
      ),
      createBrowserKey: Effect.fn("ProjectCredentialsLive.createBrowserKey")(
        (projectId, input) => persist(store.createBrowserKey(projectId, input)),
      ),
      revokeBrowserKey: Effect.fn("ProjectCredentialsLive.revokeBrowserKey")(
        (projectId, keyId) => persist(store.revokeBrowserKey(projectId, keyId)),
      ),
    })
  }),
)
