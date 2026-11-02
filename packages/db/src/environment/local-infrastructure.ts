import { createHash } from "node:crypto"
import { realpathSync } from "node:fs"
import { fileURLToPath } from "node:url"
import process from "node:process"
import { Effect, Schema } from "effect"
import { CommandConfigurationError } from "./error.js"
import { assertLocalDevelopmentDatabase, readDatabaseUrl } from "./runtime.js"

export const localDatabaseMode = Effect.fn("localDatabaseMode")(function* (
  env: NodeJS.ProcessEnv = process.env,
) {
  return yield* Schema.decodeUnknownEffect(
    Schema.Literals(["compose", "native"]),
  )(env.FLOWMARK_LOCAL_DATABASE ?? "native").pipe(
    Effect.mapError(
      () =>
        new CommandConfigurationError({
          reason:
            "FLOWMARK_LOCAL_DATABASE must be compose or native. Existing configuration without this setting remains user-managed native PostgreSQL.",
        }),
    ),
  )
})

export function localProject(root: string) {
  const checkout = createHash("sha256")
    .update(realpathSync(root))
    .digest("hex")
    .slice(0, 12)
  return { checkout, project: `flowmark-${checkout}` }
}

export const readLocalInfrastructure = Effect.fn("readLocalInfrastructure")(
  function* (env: NodeJS.ProcessEnv = process.env) {
    if ((yield* localDatabaseMode(env)) !== "compose") {
      return yield* new CommandConfigurationError({
        reason:
          "Local PostgreSQL is user-managed (native). To choose Compose explicitly, set FLOWMARK_LOCAL_DATABASE=compose and use the documented local Compose DATABASE_URL; existing env files are never rewritten.",
      })
    }
    const url = yield* readDatabaseUrl(env)
    yield* assertLocalDevelopmentDatabase(url, env)
    const port = Number(env.FLOWMARK_POSTGRES_PORT ?? "55432")
    if (!Number.isInteger(port) || port < 1024 || port > 65535) {
      return yield* new CommandConfigurationError({
        reason: "FLOWMARK_POSTGRES_PORT must be an integer from 1024 to 65535.",
      })
    }
    const matches = yield* Effect.try({
      try: () => {
        const target = new URL(url)
        return (
          target.hostname === "127.0.0.1" &&
          Number(target.port || "5432") === port &&
          target.pathname === "/flowmark" &&
          decodeURIComponent(target.username) === "flowmark" &&
          decodeURIComponent(target.password) === "local_dev_only" &&
          [...target.searchParams.keys()].every(
            (key) => key === "application_name",
          ) &&
          !target.hash
        )
      },
      catch: () =>
        new CommandConfigurationError({
          reason: "The local Compose database URL is invalid.",
        }),
    })
    if (!matches) {
      return yield* new CommandConfigurationError({
        reason:
          "DATABASE_URL does not match the local Compose host, port, database, role, or public local password. Use the server env example and keep FLOWMARK_POSTGRES_PORT consistent. Only application_name is supported as a Compose URL option; use native mode for other user-managed connection settings.",
      })
    }
    if (env.DATABASE_MIGRATION_URL) {
      yield* assertLocalDevelopmentDatabase(env.DATABASE_MIGRATION_URL, env)
      const sameTarget = yield* Effect.try({
        try: () => {
          const target = new URL(env.DATABASE_MIGRATION_URL!)
          return (
            ["postgres:", "postgresql:"].includes(target.protocol) &&
            target.hostname === "127.0.0.1" &&
            Number(target.port || "5432") === port &&
            target.pathname === "/flowmark" &&
            decodeURIComponent(target.username) === "flowmark"
          )
        },
        catch: () =>
          new CommandConfigurationError({
            reason: "The local migration override is invalid.",
          }),
      })
      if (!sameTarget) {
        return yield* new CommandConfigurationError({
          reason:
            "DATABASE_MIGRATION_URL conflicts with the selected Compose database. Correct or unset it explicitly before starting local infrastructure.",
        })
      }
    }
    for (const setting of [
      "COMPOSE_FILE",
      "COMPOSE_PROJECT_NAME",
      "COMPOSE_PROFILES",
      "COMPOSE_ENV_FILES",
      "COMPOSE_REMOVE_ORPHANS",
    ]) {
      if (env[setting]) {
        return yield* new CommandConfigurationError({
          reason: `Refusing conflicting ${setting}. Unset it explicitly before using repository infra commands.`,
        })
      }
    }
    const root = fileURLToPath(new URL("../../../../", import.meta.url))
    const identity = yield* Effect.try({
      try: () => localProject(root),
      catch: () =>
        new CommandConfigurationError({
          reason:
            "Cannot resolve this checkout's local infrastructure identity.",
        }),
    })
    return {
      ...identity,
      root,
      port,
      volume: `${identity.project}_postgres-data`,
    }
  },
)

export type LocalInfrastructure = Effect.Success<
  ReturnType<typeof readLocalInfrastructure>
>
