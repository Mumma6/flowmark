import { Effect, Layer, Redacted } from "effect"
import { ProjectCredentialsStore } from "@flowmark/db/persistence"
import { persist } from "../../../adapters/persistence-error.js"
import { ProjectCredentials } from "../ports/project-credentials.js"

export const ProjectCredentialsLive = Layer.effect(
  ProjectCredentials,
  Effect.gen(function* () {
    const store = yield* ProjectCredentialsStore
    return ProjectCredentials.of({
      consumeCreationQuota: Effect.fn(
        "ProjectCredentialsLive.consumeCreationQuota",
      )((userId, kind) => persist(store.consumeCreationQuota(userId, kind))),
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
        (userId, role) => persist(store.projectForUser(userId, role)),
      ),
      memberProject: Effect.fn("ProjectCredentialsLive.memberProject")(
        (userId, projectId, role) =>
          persist(store.memberProject(userId, projectId, role)),
      ),
      delegatedReaderProject: Effect.fn(
        "ProjectCredentialsLive.delegatedReaderProject",
      )((input) => persist(store.delegatedReaderProject(input))),
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
        (userId, projectId, name) =>
          persist(store.renameProject(userId, projectId, name)),
      ),
      listApiKeys: Effect.fn("ProjectCredentialsLive.listApiKeys")(
        (userId, projectId) => persist(store.listApiKeys(userId, projectId)),
      ),
      listBrowserKeys: Effect.fn("ProjectCredentialsLive.listBrowserKeys")(
        (userId, projectId) =>
          persist(store.listBrowserKeys(userId, projectId)),
      ),
      createApiKey: Effect.fn("ProjectCredentialsLive.createApiKey")(
        (userId, projectId, input) =>
          persist(store.createApiKey(userId, projectId, input)),
      ),
      revokeApiKey: Effect.fn("ProjectCredentialsLive.revokeApiKey")(
        (userId, projectId, keyId) =>
          persist(store.revokeApiKey(userId, projectId, keyId)),
      ),
      rotateWriteKey: Effect.fn("ProjectCredentialsLive.rotateWriteKey")(
        (userId, projectId, keyId) =>
          persist(store.rotateWriteKey(userId, projectId, keyId)),
      ),
      createBrowserKey: Effect.fn("ProjectCredentialsLive.createBrowserKey")(
        (userId, projectId, input) =>
          persist(store.createBrowserKey(userId, projectId, input)),
      ),
      revokeBrowserKey: Effect.fn("ProjectCredentialsLive.revokeBrowserKey")(
        (userId, projectId, keyId) =>
          persist(store.revokeBrowserKey(userId, projectId, keyId)),
      ),
    })
  }),
)
