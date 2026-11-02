import process from "node:process"
import { Effect } from "effect"
import { CommandConfigurationError } from "./error.js"
import { assertManagedLocalDatabase } from "./managed-local-database.js"
import {
  assertLocalDevelopmentDatabase,
  readDatabaseUrl,
  readMigrationDatabaseUrl,
} from "./runtime.js"

// Keep host identities distinct: localhost may resolve to a different listener
// than 127.0.0.1 or ::1. Passwords/options are not target identity; callers use
// the checked runtime URL for all their database work.
const databaseTarget = (value: string) => {
  const url = new URL(value)
  return [
    url.hostname.toLowerCase(),
    url.port || "5432",
    url.pathname,
    decodeURIComponent(url.username),
  ]
}

export const readLocalDevelopmentDatabaseUrl = Effect.fn(
  "readLocalDevelopmentDatabaseUrl",
)(function* (env: NodeJS.ProcessEnv = process.env) {
  const runtimeUrl = yield* readDatabaseUrl(env)
  yield* assertLocalDevelopmentDatabase(runtimeUrl, env)
  const migrationUrl = yield* readMigrationDatabaseUrl(env)
  yield* assertLocalDevelopmentDatabase(migrationUrl, env)
  const sameTarget = yield* Effect.try({
    try: () => {
      const runtime = databaseTarget(runtimeUrl)
      const migration = databaseTarget(migrationUrl)
      return runtime.every((value, index) => value === migration[index])
    },
    catch: () =>
      new CommandConfigurationError({
        reason: "Refusing local database command: the database URL is invalid.",
      }),
  })
  if (!sameTarget) {
    return yield* new CommandConfigurationError({
      reason:
        "Refusing local database command: DATABASE_MIGRATION_URL must match DATABASE_URL's host, port, database, and role. Unset the migration override or point it at the same local target.",
    })
  }
  yield* assertManagedLocalDatabase(runtimeUrl, env)
  return runtimeUrl
})
