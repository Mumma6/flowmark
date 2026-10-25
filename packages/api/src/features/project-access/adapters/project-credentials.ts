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
          store.projectForUser(userId).pipe(Effect.mapError(toPersistenceError)),
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
    })
  }),
)
