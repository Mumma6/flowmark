import { Effect, Layer, Redacted } from "effect"
import { ProjectCredentialsStore } from "@flowmark/db/persistence"
import { PersistenceError } from "../../../errors.js"
import { ProjectCredentials } from "../ports/project-credentials.js"

const toPersistenceError = (error: {
  readonly operation: string
  readonly cause: unknown
}) =>
  new PersistenceError({
    operation: error.operation,
    cause: error.cause,
  })

export const ProjectCredentialsLive = Layer.effect(
  ProjectCredentials,
  Effect.gen(function* () {
    const store = yield* ProjectCredentialsStore
    return ProjectCredentials.of({
      authenticateBrowser: Effect.fn(
        "PostgresProjectCredentials.authenticateBrowser",
      )((key) =>
        store
          .authenticateBrowser(Redacted.value(key))
          .pipe(Effect.mapError(toPersistenceError)),
      ),
      browserOriginAllowed: Effect.fn(
        "PostgresProjectCredentials.browserOriginAllowed",
      )((origin) =>
        store
          .browserOriginAllowed(origin)
          .pipe(Effect.mapError(toPersistenceError)),
      ),
      consumeBrowserQuota: Effect.fn(
        "PostgresProjectCredentials.consumeBrowserQuota",
      )((keyId) =>
        store
          .consumeBrowserQuota(keyId)
          .pipe(Effect.mapError(toPersistenceError)),
      ),
      authenticate: Effect.fn("PostgresProjectCredentials.authenticate")(
        (key, permission) =>
          store
            .authenticate(Redacted.value(key), permission)
            .pipe(Effect.mapError(toPersistenceError)),
      ),
      projectForUser: Effect.fn("PostgresProjectCredentials.projectForUser")(
        (userId) =>
          store
            .projectForUser(userId)
            .pipe(Effect.mapError(toPersistenceError)),
      ),
      memberProject: Effect.fn("PostgresProjectCredentials.memberProject")(
        (userId, projectId) =>
          store
            .memberProject(userId, projectId)
            .pipe(Effect.mapError(toPersistenceError)),
      ),
      listProjects: Effect.fn("PostgresProjectCredentials.listProjects")(
        (userId) =>
          store.listProjects(userId).pipe(Effect.mapError(toPersistenceError)),
      ),
      workspaceForUser: Effect.fn(
        "PostgresProjectCredentials.workspaceForUser",
      )((userId) =>
        store
          .workspaceForUser(userId)
          .pipe(Effect.mapError(toPersistenceError)),
      ),
      onboardingState: Effect.fn("PostgresProjectCredentials.onboardingState")(
        (userId) =>
          store
            .onboardingState(userId)
            .pipe(Effect.mapError(toPersistenceError)),
      ),
      updateOnboardingState: Effect.fn(
        "PostgresProjectCredentials.updateOnboardingState",
      )((userId, step, completedAt) =>
        store
          .updateOnboardingState(userId, step, completedAt)
          .pipe(Effect.mapError(toPersistenceError)),
      ),
      addOwner: Effect.fn("PostgresProjectCredentials.addOwner")(
        (userId, projectId) =>
          store
            .addOwner(userId, projectId)
            .pipe(Effect.mapError(toPersistenceError)),
      ),
      createOwnedProject: Effect.fn(
        "PostgresProjectCredentials.createOwnedProject",
      )((userId, names) =>
        store
          .createOwnedProject(userId, names)
          .pipe(Effect.mapError(toPersistenceError)),
      ),
      createProject: Effect.fn("PostgresProjectCredentials.createProject")(
        (userId, workspaceId, name) =>
          store
            .createProject(userId, workspaceId, name)
            .pipe(Effect.mapError(toPersistenceError)),
      ),
      renameProject: Effect.fn("PostgresProjectCredentials.renameProject")(
        (projectId, name) =>
          store
            .renameProject(projectId, name)
            .pipe(Effect.mapError(toPersistenceError)),
      ),
      listApiKeys: Effect.fn("PostgresProjectCredentials.listApiKeys")(
        (projectId) =>
          store
            .listApiKeys(projectId)
            .pipe(Effect.mapError(toPersistenceError)),
      ),
      listBrowserKeys: Effect.fn("PostgresProjectCredentials.listBrowserKeys")(
        (projectId) =>
          store
            .listBrowserKeys(projectId)
            .pipe(Effect.mapError(toPersistenceError)),
      ),
      createApiKey: Effect.fn("PostgresProjectCredentials.createApiKey")(
        (projectId, input) =>
          store
            .createApiKey(projectId, input)
            .pipe(Effect.mapError(toPersistenceError)),
      ),
      revokeApiKey: Effect.fn("PostgresProjectCredentials.revokeApiKey")(
        (projectId, keyId) =>
          store
            .revokeApiKey(projectId, keyId)
            .pipe(Effect.mapError(toPersistenceError)),
      ),
      createBrowserKey: Effect.fn(
        "PostgresProjectCredentials.createBrowserKey",
      )((projectId, input) =>
        store
          .createBrowserKey(projectId, input)
          .pipe(Effect.mapError(toPersistenceError)),
      ),
      revokeBrowserKey: Effect.fn(
        "PostgresProjectCredentials.revokeBrowserKey",
      )((projectId, keyId) =>
        store
          .revokeBrowserKey(projectId, keyId)
          .pipe(Effect.mapError(toPersistenceError)),
      ),
    })
  }),
)
