import process from "node:process"
import net from "node:net"
import { basename } from "node:path"
import { Effect, Match, Schema } from "effect"
import { CommandConfigurationError } from "../environment/error.js"
import { loadApiEnvironment } from "../environment/load.js"
import {
  composeArgs,
  composeEnvironment,
  dockerCommand,
  localDocker,
} from "../environment/local-docker.js"
import { readLocalInfrastructure } from "../environment/local-infrastructure.js"
import {
  assertLocalContainerReady,
  inspectLocalContainer,
  inspectLocalVolume,
} from "../environment/managed-local-database.js"
import { runDatabaseCommand } from "./run.js"

const Operation = Schema.Literals([
  "doctor",
  "up",
  "status",
  "logs",
  "restart",
  "down",
])

const assertPortAvailable = (port: number) =>
  Effect.tryPromise({
    try: () =>
      new Promise<void>((resolve, reject) => {
        const server = net.createServer()
        server.once("error", reject)
        server.listen({ host: "127.0.0.1", port, exclusive: true }, () =>
          server.close((error) => (error ? reject(error) : resolve())),
        )
      }),
    catch: () =>
      new CommandConfigurationError({
        reason:
          "The PostgreSQL port is occupied or the sandbox denied a loopback bind. Inspect the port owner; choose a different FLOWMARK_POSTGRES_PORT and matching DATABASE_URL instead of stopping another service.",
      }),
  })

export const runLocalInfrastructure = Effect.fn("runLocalInfrastructure")(
  function* (
    operation: string,
    args: readonly string[],
    env: NodeJS.ProcessEnv = process.env,
    checkPort: (
      port: number,
    ) => Effect.Effect<void, CommandConfigurationError> = assertPortAvailable,
  ) {
    const command = yield* Schema.decodeUnknownEffect(Operation)(
      operation,
    ).pipe(
      Effect.mapError(
        () =>
          new CommandConfigurationError({
            reason:
              "Expected infra operation: doctor, up, status, logs, restart, or down.",
          }),
      ),
    )
    const supplied = args.filter((arg) => arg !== "--")
    if (
      supplied.length &&
      !(
        command === "restart" &&
        supplied.length === 1 &&
        supplied[0] === "postgres"
      ) &&
      !(
        command === "up" &&
        supplied.length === 1 &&
        supplied[0] === "--recreate"
      ) &&
      !(
        command === "down" &&
        supplied.length === 2 &&
        supplied[0] === "--container" &&
        /^[a-f0-9]{12,64}$/.test(supplied[1])
      )
    ) {
      return yield* new CommandConfigurationError({
        reason:
          "Unexpected infra arguments. Only postgres is managed; up optionally accepts --recreate and down accepts --container <started-container-id>.",
      })
    }
    const config = yield* readLocalInfrastructure(env)
    const docker = yield* localDocker(env)
    const childEnv = composeEnvironment(config, docker.env)
    const before = yield* inspectLocalContainer(config, childEnv)
    if (!before) {
      yield* inspectLocalVolume(config, childEnv)
    }
    const base = {
      project: config.project,
      volume: config.volume,
      context: docker.context,
      container: before?.Id ?? null,
      state: before?.State.Status ?? "absent",
      healthy: before?.State.Health?.Status ?? "unchecked",
      migrations: "not checked",
      startedByThisCall: false,
    }
    return yield* Match.value(command).pipe(
      Match.when("status", () => Effect.succeed(base)),
      Match.when("logs", () =>
        Effect.gen(function* () {
          if (!before) {
            return yield* new CommandConfigurationError({
              reason: "No PostgreSQL container exists for this checkout.",
            })
          }
          const logs = yield* dockerCommand(
            ["logs", "--tail", "100", before.Id],
            childEnv,
          )
          return {
            ...base,
            logs: logs?.replace(
              /postgres(?:ql)?:\/\/[^\s]+/gi,
              "[redacted database URL]",
            ),
          }
        }),
      ),
      Match.when("down", () =>
        Effect.gen(function* () {
          if (supplied[0] === "--container" && supplied[1] !== before?.Id) {
            return yield* new CommandConfigurationError({
              reason:
                "The supplied started-container ID no longer matches this checkout. Refusing to stop it.",
            })
          }
          if (before?.State.Running) {
            yield* dockerCommand(
              composeArgs(config, ["stop", "--timeout", "10", "postgres"]),
              childEnv,
            )
          }
          return {
            ...base,
            state: before ? "stopped" : "absent",
            healthy: "unchecked",
          }
        }),
      ),
      Match.when("up", () =>
        Effect.gen(function* () {
          if (!before?.State.Running || supplied[0] === "--recreate") {
            if (!before?.State.Running) {
              yield* checkPort(config.port)
            }
            yield* dockerCommand(
              composeArgs(config, [
                "up",
                "--detach",
                "--wait",
                "--wait-timeout",
                "30",
                supplied[0] === "--recreate"
                  ? "--force-recreate"
                  : "--no-recreate",
                "postgres",
              ]),
              childEnv,
            )
          }
          const ready = yield* assertLocalContainerReady(config, childEnv)
          return {
            ...base,
            container: ready.Id,
            state: "running",
            healthy: "healthy",
            database: "flowmark",
            role: "flowmark",
            startedByThisCall: !before?.State.Running,
          }
        }),
      ),
      Match.when("restart", () =>
        Effect.gen(function* () {
          if (!before?.State.Running) {
            return yield* new CommandConfigurationError({
              reason:
                "Only an already-running owned PostgreSQL service can be restarted. Use pnpm infra up for startup.",
            })
          }
          yield* dockerCommand(
            composeArgs(config, ["restart", "--timeout", "10", "postgres"]),
            childEnv,
          )
          yield* dockerCommand(
            composeArgs(config, [
              "up",
              "--detach",
              "--wait",
              "--wait-timeout",
              "30",
              "--no-recreate",
              "postgres",
            ]),
            childEnv,
          )
          yield* assertLocalContainerReady(config, childEnv)
          return { ...base, state: "running", healthy: "healthy" }
        }),
      ),
      Match.when("doctor", () =>
        Effect.gen(function* () {
          if (!before?.State.Running) {
            yield* checkPort(config.port)
            return {
              ...base,
              databaseReady: false,
              next: "Engine/configuration checked. Run pnpm infra up, then apply reviewed migrations explicitly.",
            }
          }
          yield* assertLocalContainerReady(config, childEnv)
          return {
            ...base,
            connection:
              "container database and role verified; published endpoint matches config",
            next: "Apply reviewed migrations explicitly; API /api/health is liveness only.",
          }
        }),
      ),
      Match.exhaustive,
    )
  },
)

// Importing the workflow in tests must not start a CLI or load developer env.
if (["infra.ts", "infra.js"].includes(basename(process.argv[1] ?? ""))) {
  await runDatabaseCommand(
    Effect.gen(function* () {
      yield* loadApiEnvironment
      const result = yield* runLocalInfrastructure(
        process.argv[2] ?? "",
        process.argv.slice(3),
      )
      yield* Effect.sync(() => console.log(JSON.stringify(result, null, 2)))
    }),
  )
}
