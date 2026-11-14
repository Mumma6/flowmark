import { Effect } from "effect"
import { assertTestDatabaseTarget } from "./test-database.js"
import { readLocalDevelopmentDatabaseUrl } from "./local-database.js"
import { CommandConfigurationError } from "./error.js"
/** Deliberately unavailable on hosted runtimes until ADR 0019's cleanup gate is met. */
export const assertLocalEvidenceCaptureTarget = Effect.fn(
  "assertLocalEvidenceCaptureTarget",
)(function* (env: NodeJS.ProcessEnv = process.env) {
  if (
    env.NODE_ENV === "production" ||
    env.VERCEL ||
    env.VERCEL_ENV ||
    env.FLOWMARK_MIGRATION_APPROVED ||
    env.FLOWMARK_MIGRATION_WRAPPER
  ) {
    return yield* new CommandConfigurationError({
      reason:
        "Evidence capture is not enabled on hosted or production runtimes.",
    })
  }
  if (env.TEST_DATABASE_URL) {
    yield* assertTestDatabaseTarget(env)
    return
  }
  yield* readLocalDevelopmentDatabaseUrl(env)
})
