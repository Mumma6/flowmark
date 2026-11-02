import process from "node:process"
import { Effect } from "effect"
import { CommandConfigurationError } from "./error.js"
import { readLocalDevelopmentDatabaseUrl } from "./local-database.js"
import { assertMigrationTarget } from "./migration-target.js"
import { isLoopbackDatabaseUrl, readMigrationDatabaseUrl } from "./runtime.js"
import { assertTestDatabaseTarget } from "./test-database.js"

// All migration/history commands use the same target proof. Disposable test
// provenance is independent of development/demo ownership and hosted approval.
export const readCheckedMigrationDatabaseUrl = Effect.fn(
  "readCheckedMigrationDatabaseUrl",
)(function* (localOnly: boolean, env: NodeJS.ProcessEnv = process.env) {
  const url = yield* readMigrationDatabaseUrl(env)
  yield* assertMigrationTarget(url, env)
  if (localOnly && !isLoopbackDatabaseUrl(url)) {
    return yield* new CommandConfigurationError({
      reason:
        "Refusing local migrate: hosted targets require their approved environment wrapper.",
    })
  }
  if (isLoopbackDatabaseUrl(url)) {
    if (!localOnly && env.FLOWMARK_TEST_DATABASE_SOURCE) {
      yield* assertTestDatabaseTarget(env)
    } else {
      return yield* readLocalDevelopmentDatabaseUrl(env)
    }
  }
  return url
})
