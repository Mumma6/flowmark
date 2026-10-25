import { Effect, Layer, Redacted } from "effect"
import {
  authenticateBrowserKey,
  authenticateKey,
  browserOriginAllowed,
  consumeBrowserQuota,
  DatabaseError,
  Database,
} from "@flowmark/db/store"
import { PersistenceError } from "../../../errors.js"
import { ProjectCredentials } from "../ports/project-credentials.js"

const mapDatabaseError = (error: DatabaseError) =>
  new PersistenceError({
    operation: error.operation,
    cause: error.cause,
  })

export const ProjectCredentialsLive = Layer.effect(
  ProjectCredentials,
  Effect.gen(function* () {
    const db = yield* Database
    return ProjectCredentials.of({
      authenticateBrowser: Effect.fn(
        "PostgresProjectCredentials.authenticateBrowser",
      )((key) =>
        authenticateBrowserKey(Redacted.value(key)).pipe(
          Effect.provideService(Database, db),
          Effect.mapError(mapDatabaseError),
        ),
      ),
      browserOriginAllowed: Effect.fn(
        "PostgresProjectCredentials.browserOriginAllowed",
      )((origin) =>
        browserOriginAllowed(origin).pipe(
          Effect.provideService(Database, db),
          Effect.mapError(mapDatabaseError),
        ),
      ),
      consumeBrowserQuota: Effect.fn(
        "PostgresProjectCredentials.consumeBrowserQuota",
      )((keyId) =>
        consumeBrowserQuota(keyId).pipe(
          Effect.provideService(Database, db),
          Effect.mapError(mapDatabaseError),
        ),
      ),
      authenticate: Effect.fn("PostgresProjectCredentials.authenticate")(
        (key, permission) =>
          authenticateKey(Redacted.value(key), permission).pipe(
            Effect.provideService(Database, db),
            Effect.mapError(mapDatabaseError),
          ),
      ),
    })
  }),
)
