import process from "node:process"
import { Effect } from "effect"
import { CommandConfigurationError } from "./error.js"

export function isProductionEnvironment(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return env.NODE_ENV === "production" || env.VERCEL_ENV === "production"
}

export function isDemoModeEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return env.FLOWMARK_DEMO_MODE === "true"
}

export function isLoopbackDatabaseUrl(url: string): boolean {
  return ["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname)
}

export const readDatabaseUrl = Effect.fn("readDatabaseUrl")(function* (
  env: NodeJS.ProcessEnv = process.env,
) {
  const url = env.DATABASE_URL
  if (!url) {
    return yield* new CommandConfigurationError({
      reason:
        "DATABASE_URL is required. Use a dedicated development PostgreSQL database.",
    })
  }
  return url
})

export const readMigrationDatabaseUrl = Effect.fn("readMigrationDatabaseUrl")(
  function* (env: NodeJS.ProcessEnv = process.env) {
    const url = env.DATABASE_MIGRATION_URL ?? env.DATABASE_URL
    if (!url) {
      return yield* new CommandConfigurationError({
        reason:
          "DATABASE_MIGRATION_URL or DATABASE_URL is required to apply migrations.",
      })
    }
    return url
  },
)

export const assertLocalDevelopmentDatabase = Effect.fn(
  "assertLocalDevelopmentDatabase",
)(function* (url: string, env: NodeJS.ProcessEnv = process.env) {
  if (isProductionEnvironment(env)) {
    return yield* new CommandConfigurationError({
      reason:
        "Refusing local development database command in a production environment.",
    })
  }
  if (!isDemoModeEnabled(env)) {
    return yield* new CommandConfigurationError({
      reason:
        "Set FLOWMARK_DEMO_MODE=true explicitly for local development database commands.",
    })
  }
  if (!isLoopbackDatabaseUrl(url)) {
    return yield* new CommandConfigurationError({
      reason:
        "Refusing local development database command: the database must be on loopback.",
    })
  }
})
