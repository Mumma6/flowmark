import { Effect, Layer, Redacted } from "effect"
import { ProjectCredentialsStore } from "@flowmark/db/persistence"
import { toPersistenceError } from "../../../adapters/persistence-error.js"
import { ProjectCredentials } from "../ports/project-credentials.js"

export const ProjectCredentialsLive = Layer.effect(
  ProjectCredentials,
  Effect.gen(function* () {
    const store = yield* ProjectCredentialsStore
    return ProjectCredentials.of({
      authenticateBrowser: Effect.fn(
        "ProjectCredentialsLive.authenticateBrowser",
      )((key) =>
        store
          .authenticateBrowser(Redacted.value(key))
          .pipe(Effect.mapError(toPersistenceError)),
      ),
      browserOriginAllowed: Effect.fn(
        "ProjectCredentialsLive.browserOriginAllowed",
      )((origin) =>
        store
          .browserOriginAllowed(origin)
          .pipe(Effect.mapError(toPersistenceError)),
      ),
      consumeBrowserQuota: Effect.fn(
        "ProjectCredentialsLive.consumeBrowserQuota",
      )((keyId) =>
        store
          .consumeBrowserQuota(keyId)
          .pipe(Effect.mapError(toPersistenceError)),
      ),
      authenticate: Effect.fn("ProjectCredentialsLive.authenticate")(
        (key, permission) =>
          store
            .authenticate(Redacted.value(key), permission)
            .pipe(Effect.mapError(toPersistenceError)),
      ),
      projectForUser: Effect.fn("ProjectCredentialsLive.projectForUser")(
        (userId) =>
          store
            .projectForUser(userId)
            .pipe(Effect.mapError(toPersistenceError)),
      ),
      memberProject: Effect.fn("ProjectCredentialsLive.memberProject")(
        (userId, projectId) =>
          store
            .memberProject(userId, projectId)
            .pipe(Effect.mapError(toPersistenceError)),
      ),
      listProjects: Effect.fn("ProjectCredentialsLive.listProjects")((userId) =>
        store.listProjects(userId).pipe(Effect.mapError(toPersistenceError)),
      ),
      workspaceForUser: Effect.fn("ProjectCredentialsLive.workspaceForUser")(
        (userId) =>
          store
            .workspaceForUser(userId)
            .pipe(Effect.mapError(toPersistenceError)),
      ),
      onboardingState: Effect.fn("ProjectCredentialsLive.onboardingState")(
        (userId) =>
          store
            .onboardingState(userId)
            .pipe(Effect.mapError(toPersistenceError)),
      ),
      updateOnboardingState: Effect.fn(
        "ProjectCredentialsLive.updateOnboardingState",
      )((userId, step, completedAt) =>
        store
          .updateOnboardingState(userId, step, completedAt)
          .pipe(Effect.mapError(toPersistenceError)),
      ),
      createOwnedProject: Effect.fn(
        "ProjectCredentialsLive.createOwnedProject",
      )((userId, names) =>
        store
          .createOwnedProject(userId, names)
          .pipe(Effect.mapError(toPersistenceError)),
      ),
      createProject: Effect.fn("ProjectCredentialsLive.createProject")(
        (userId, workspaceId, name) =>
          store
            .createProject(userId, workspaceId, name)
            .pipe(Effect.mapError(toPersistenceError)),
      ),
      renameProject: Effect.fn("ProjectCredentialsLive.renameProject")(
        (projectId, name) =>
          store
            .renameProject(projectId, name)
            .pipe(Effect.mapError(toPersistenceError)),
      ),
      listApiKeys: Effect.fn("ProjectCredentialsLive.listApiKeys")(
        (projectId) =>
          store
            .listApiKeys(projectId)
            .pipe(Effect.mapError(toPersistenceError)),
      ),
      listBrowserKeys: Effect.fn("ProjectCredentialsLive.listBrowserKeys")(
        (projectId) =>
          store
            .listBrowserKeys(projectId)
            .pipe(Effect.mapError(toPersistenceError)),
      ),
      createApiKey: Effect.fn("ProjectCredentialsLive.createApiKey")(
        (projectId, input) =>
          store
            .createApiKey(projectId, input)
            .pipe(Effect.mapError(toPersistenceError)),
      ),
      revokeApiKey: Effect.fn("ProjectCredentialsLive.revokeApiKey")(
        (projectId, keyId) =>
          store
            .revokeApiKey(projectId, keyId)
            .pipe(Effect.mapError(toPersistenceError)),
      ),
      rotateWriteKey: Effect.fn("ProjectCredentialsLive.rotateWriteKey")(
        (projectId, keyId) =>
          store
            .rotateWriteKey(projectId, keyId)
            .pipe(Effect.mapError(toPersistenceError)),
      ),
      createBrowserKey: Effect.fn("ProjectCredentialsLive.createBrowserKey")(
        (projectId, input) =>
          store
            .createBrowserKey(projectId, input)
            .pipe(Effect.mapError(toPersistenceError)),
      ),
      revokeBrowserKey: Effect.fn("ProjectCredentialsLive.revokeBrowserKey")(
        (projectId, keyId) =>
          store
            .revokeBrowserKey(projectId, keyId)
            .pipe(Effect.mapError(toPersistenceError)),
      ),
    })
  }),
)
