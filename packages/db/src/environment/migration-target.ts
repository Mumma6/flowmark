import { Effect, Schema } from "effect"
import { CommandConfigurationError } from "./error.js"

const HostedMigrationWrapper = Schema.Literal(
  "production",
  "preview",
  "staging",
)

export const assertMigrationTarget = Effect.fn("assertMigrationTarget")(
  function* (url: string, env: NodeJS.ProcessEnv = process.env) {
    const target = yield* Effect.try({
      try: () => new URL(url),
      catch: () =>
        new CommandConfigurationError({
          reason: "Refusing migrate: the database URL is invalid.",
        }),
    })
    if (!["postgres:", "postgresql:"].includes(target.protocol)) {
      return yield* new CommandConfigurationError({
        reason: "Refusing migrate: a PostgreSQL URL is required.",
      })
    }
    if (["localhost", "127.0.0.1", "[::1]"].includes(target.hostname)) {
      return
    }
    const wrapper = yield* Schema.decodeUnknown(HostedMigrationWrapper)(
      env.FLOWMARK_MIGRATION_WRAPPER,
    ).pipe(
      Effect.mapError(
        () =>
          new CommandConfigurationError({
            reason:
              "Refusing migrate: non-loopback databases require db:migrate:prod, db:migrate:preview, or db:migrate:staging with explicit confirmation.",
          }),
      ),
    )
    if (
      env.FLOWMARK_MIGRATION_TARGET_HOST !== target.hostname ||
      env.NEON_BRANCH !== wrapper ||
      env.DATABASE_MIGRATION_URL !== url ||
      !target.hostname.endsWith(".neon.tech") ||
      target.hostname.split(".")[0]?.endsWith("-pooler")
    ) {
      return yield* new CommandConfigurationError({
        reason:
          "Refusing migrate: the wrapper must confirm the exact direct Neon host and branch for DATABASE_MIGRATION_URL.",
      })
    }
  },
)
