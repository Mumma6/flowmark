import process from "node:process"
import { randomBytes } from "node:crypto"
import { mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { Effect, Schema } from "effect"
import { CommandConfigurationError } from "../environment/error.js"
import {
  composeArgs,
  composeEnvironment,
  dockerCommand,
  dockerJson,
  localDocker,
} from "../environment/local-docker.js"
import {
  assertComposeOverrides,
  localProject,
} from "../environment/local-infrastructure.js"
import {
  assertTestDatabaseTarget,
  inspectTestContainer,
} from "../environment/test-database.js"
import { runIntegrationChecks } from "./integration-checks.js"
import { redactTestOutput } from "./integration-command.js"

const root = fileURLToPath(new URL("../../../../", import.meta.url))
const Labels = Schema.Record(Schema.String, Schema.String)
const configurationFailure = () =>
  new CommandConfigurationError({
    reason: "Cannot prepare the disposable integration run.",
  })

function childEnvironment(source: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {}
  for (const key of Object.keys(source)) {
    if (
      [
        "PATH",
        "HOME",
        "USER",
        "LOGNAME",
        "TMPDIR",
        "TMP",
        "TEMP",
        "SystemRoot",
        "COMSPEC",
        "PATHEXT",
        "LANG",
        "LC_ALL",
        "CI",
        "GITHUB_ACTIONS",
        "RUNNER_TEMP",
        "RUNNER_OS",
      ].includes(key) ||
      key.startsWith("DOCKER_") ||
      key.startsWith("COMPOSE_")
    ) {
      env[key] = source[key]
    }
  }
  return {
    ...env,
    NODE_ENV: "test",
    VERCEL_ENV: "",
    FLOWMARK_DEMO_MODE: "false",
    FLOWMARK_MIGRATION_WRAPPER: "",
    FLOWMARK_MIGRATION_APPROVED: "",
    MIGRATION_DATABASE_URL: "",
    NEON_BRANCH: "",
    BETTER_AUTH_SECRET: randomBytes(32).toString("hex"),
    BETTER_AUTH_URL: "http://localhost:3001",
    FLOWMARK_DASHBOARD_ORIGIN: "http://localhost:3001",
  }
}

export const cleanupTestProject = Effect.fn("cleanupTestProject")(function* (
  config: { root: string; project: string },
  env: NodeJS.ProcessEnv,
) {
  const ids = yield* dockerCommand(
    [
      "ps",
      "--all",
      "--quiet",
      "--no-trunc",
      "--filter",
      `label=com.docker.compose.project=${config.project}`,
    ],
    env,
  )
  for (const id of ids?.split("\n").filter(Boolean) ?? []) {
    yield* inspectTestContainer(
      { ...env, FLOWMARK_TEST_CONTAINER_ID: id },
      false,
    )
  }
  const network = yield* dockerJson(
    [
      "network",
      "inspect",
      `${config.project}_default`,
      "--format",
      "{{json .Labels}}",
    ],
    env,
    true,
  )
  if (network !== undefined) {
    const labels = yield* Schema.decodeUnknownEffect(Labels)(network).pipe(
      Effect.mapError(configurationFailure),
    )
    if (
      labels["com.docker.compose.project"] !== config.project ||
      labels["io.flowmark.test-run"] !== env.FLOWMARK_TEST_RUN_ID
    ) {
      return yield* new CommandConfigurationError({
        reason: `Refusing cleanup of unexpected network for ${config.project}.`,
      })
    }
  }
  if (ids || network !== undefined) {
    yield* dockerCommand(
      composeArgs(config, ["--profile", "test", "down", "--timeout", "10"]),
      env,
    )
  }
  const remaining = yield* dockerCommand(
    [
      "ps",
      "--all",
      "--quiet",
      "--no-trunc",
      "--filter",
      `label=com.docker.compose.project=${config.project}`,
    ],
    env,
  )
  const remainingNetwork = yield* dockerJson(
    [
      "network",
      "inspect",
      `${config.project}_default`,
      "--format",
      "{{json .Labels}}",
    ],
    env,
    true,
  )
  if (remaining || remainingNetwork !== undefined) {
    return yield* new CommandConfigurationError({
      reason: `Owned test resources remain for ${config.project}; inspect this run explicitly.`,
    })
  }
})

export const runDisposableIntegration = Effect.fn("runDisposableIntegration")(
  function* (
    args: readonly string[],
    failed: (code: number) => void,
    source: NodeJS.ProcessEnv = process.env,
  ) {
    const ci = args.length === 1 && args[0] === "--ci-service"
    if (args.length && !ci) {
      return yield* new CommandConfigurationError({
        reason:
          "Use pnpm test:integration with no arguments locally; --ci-service is restricted to the declared Actions service job.",
      })
    }
    const run = randomBytes(16).toString("hex")
    const directory = yield* Effect.try({
      try: () => mkdtempSync(join(tmpdir(), `flowmark-integration-${run}-`)),
      catch: configurationFailure,
    })
    yield* Effect.sync(() => console.log(`Integration reports: ${directory}`))
    if (ci) {
      yield* assertTestDatabaseTarget(source)
      const env = {
        ...childEnvironment(source),
        TEST_DATABASE_URL: source.TEST_DATABASE_URL,
        DATABASE_URL: source.DATABASE_URL,
        DATABASE_MIGRATION_URL: source.DATABASE_MIGRATION_URL,
        FLOWMARK_TEST_DATABASE_SOURCE: source.FLOWMARK_TEST_DATABASE_SOURCE,
      }
      yield* runIntegrationChecks(root, env, directory, failed)
      return
    }
    for (const key of [
      "TEST_DATABASE_URL",
      "DATABASE_URL",
      "DATABASE_MIGRATION_URL",
      "FLOWMARK_MIGRATION_WRAPPER",
      "FLOWMARK_MIGRATION_APPROVED",
      "MIGRATION_DATABASE_URL",
      "NEON_BRANCH",
      "FLOWMARK_TEST_DATABASE_SOURCE",
      "FLOWMARK_TEST_CONTAINER_ID",
      "FLOWMARK_TEST_PROJECT",
      "FLOWMARK_TEST_RUN_ID",
    ]) {
      if (source[key]) {
        return yield* new CommandConfigurationError({
          reason: `Refusing ambient ${key}. Unset it explicitly; local integration runs always create their own disposable target.`,
        })
      }
    }
    if (source.GITHUB_ACTIONS === "true") {
      return yield* new CommandConfigurationError({
        reason:
          "Actions must use the explicit --ci-service path and its declared disposable service target.",
      })
    }
    yield* assertComposeOverrides(source)
    const docker = yield* localDocker(source)
    // localDocker verified any host override against this context's endpoint.
    // Children use that exact pinned context, without redundant host flags or
    // a global context/environment change.
    const selectedDockerEnv = { ...docker.env }
    delete selectedDockerEnv.DOCKER_HOST
    yield* Effect.sync(() =>
      console.log(`Integration Docker context: ${docker.context}`),
    )
    const config = {
      root,
      project: `flowmark-test-${run}`,
      checkout: localProject(root).checkout,
      port: 55432,
    }
    const env = {
      ...composeEnvironment(config, childEnvironment(selectedDockerEnv)),
      FLOWMARK_TEST_RUN_ID: run,
      FLOWMARK_TEST_PROJECT: config.project,
      FLOWMARK_TEST_DATABASE_SOURCE: "compose",
    }
    let completed = false
    yield* Effect.acquireRelease(
      Effect.sync(() => {
        writeFileSync(
          join(directory, "run.json"),
          JSON.stringify(
            {
              project: config.project,
              context: docker.context,
              run,
              pid: process.pid,
            },
            null,
            2,
          ),
        )
        console.log(`Disposable project: ${config.project}`)
        return config
      }),
      () =>
        Effect.gen(function* () {
          if (!completed) {
            yield* dockerCommand(
              composeArgs(config, ["logs", "--tail", "100", "postgres-test"]),
              env,
            ).pipe(
              Effect.flatMap((logs) =>
                Effect.try({
                  try: () =>
                    writeFileSync(
                      join(directory, "postgres.log"),
                      redactTestOutput(logs ?? ""),
                    ),
                  catch: () =>
                    new CommandConfigurationError({
                      reason: "Cannot save PostgreSQL diagnostics.",
                    }),
                }),
              ),
              Effect.catchTag("CommandConfigurationError", (error) =>
                Effect.sync(() =>
                  console.error(
                    `Test diagnostics unavailable: ${error.reason}`,
                  ),
                ),
              ),
            )
          }
          yield* cleanupTestProject(config, env).pipe(
            Effect.catchTag("CommandConfigurationError", (error) =>
              Effect.sync(() => {
                console.error(
                  `Cleanup failed for ${config.project}: ${error.reason}`,
                )
              }).pipe(Effect.andThen(Effect.die(error))),
            ),
          )
          yield* Effect.sync(() =>
            console.log(
              `Removed owned test containers/network: ${config.project}. No volumes deleted.`,
            ),
          )
        }),
    )
    yield* dockerCommand(
      composeArgs(config, [
        "up",
        "--detach",
        "--wait",
        "--wait-timeout",
        "30",
        "postgres-test",
      ]),
      env,
    )
    const id = yield* dockerCommand(
      composeArgs(config, ["ps", "--all", "--quiet", "postgres-test"]),
      env,
    )
    const owned = { ...env, FLOWMARK_TEST_CONTAINER_ID: id ?? "" }
    const container = yield* inspectTestContainer(owned)
    const volumes = yield* dockerCommand(
      [
        "volume",
        "ls",
        "--quiet",
        "--filter",
        `label=com.docker.compose.project=${config.project}`,
      ],
      env,
    )
    if (volumes) {
      return yield* new CommandConfigurationError({
        reason: `Unexpected persistent test volumes exist for ${config.project}: ${volumes}. They were retained; no volume deletion is authorized.`,
      })
    }
    const ports = container.NetworkSettings.Ports["5432/tcp"]
    if (
      ports?.length !== 1 ||
      ports[0].HostIp !== "127.0.0.1" ||
      !/^\d+$/.test(ports[0].HostPort)
    ) {
      return yield* configurationFailure()
    }
    const port = ports[0].HostPort
    const url = `postgresql://flowmark_test:local_test_only@127.0.0.1:${port}/flowmark_test`
    const target = {
      ...owned,
      TEST_DATABASE_URL: url,
      DATABASE_URL: url,
      DATABASE_MIGRATION_URL: url,
    }
    yield* Effect.sync(() =>
      writeFileSync(
        join(directory, "run.json"),
        JSON.stringify(
          {
            project: config.project,
            context: docker.context,
            run,
            pid: process.pid,
            container: container.Id,
            port,
          },
          null,
          2,
        ),
      ),
    )
    yield* runIntegrationChecks(root, target, directory, failed)
    completed = true
  },
)
