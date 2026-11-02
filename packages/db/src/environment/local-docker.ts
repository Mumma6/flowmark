import { spawnSync } from "node:child_process"
import { Effect, Schema } from "effect"
import { CommandConfigurationError } from "./error.js"
import type { LocalInfrastructure } from "./local-infrastructure.js"

export const dockerCommand = Effect.fn("dockerCommand")(function* (
  args: readonly string[],
  env: NodeJS.ProcessEnv,
  allowMissing: boolean = false,
) {
  const result = yield* Effect.try({
    try: () =>
      spawnSync("docker", [...args], {
        env,
        encoding: "utf8",
        timeout: 45000,
        maxBuffer: 1024 * 1024,
      }),
    catch: () =>
      new CommandConfigurationError({
        reason: "Docker CLI could not be executed.",
      }),
  })
  if (result.status !== 0) {
    const details = `${result.error?.message ?? ""} ${result.stderr}`
    if (
      allowMissing &&
      !result.error &&
      !/permission denied|EACCES|EPERM|operation not permitted/i.test(
        details,
      ) &&
      /no such (volume|object|container)/i.test(details)
    ) {
      return null
    }
    const reason =
      /permission denied|EACCES|EPERM|operation not permitted/i.test(details)
        ? "Docker socket access was denied by permissions or the agent sandbox. Leave security controls unchanged; real-container checks require an environment with permitted socket access."
        : result.error?.message.includes("ENOENT")
          ? "Docker CLI is missing. Install a supported Docker implementation outside this command."
          : result.error?.message.includes("ETIMEDOUT")
            ? "Docker command timed out. Inspect engine/service health; do not stop unrelated services."
            : args[0] === "compose" && args[1] === "version"
              ? "Docker Compose is unavailable. Install/update the Compose plugin outside this command."
              : args[0] === "exec"
                ? "PostgreSQL could not verify the configured database/role credentials. Existing volumes retain their initialization settings; inspect configuration instead of resetting data."
                : "Docker command failed. The engine may be stopped/unreachable, or startup failed. Check the selected runtime, then use pnpm infra status and bounded pnpm infra logs."
    return yield* new CommandConfigurationError({ reason })
  }
  return (
    args[0] === "logs" ? result.stdout + result.stderr : result.stdout
  ).trim()
})

export const dockerJson = Effect.fn("dockerJson")(function* (
  args: readonly string[],
  env: NodeJS.ProcessEnv,
  allowMissing: boolean = false,
) {
  const output = yield* dockerCommand(args, env, allowMissing)
  if (output === null) {
    return undefined
  }
  return yield* Effect.try({
    try: (): unknown => JSON.parse(output),
    catch: () =>
      new CommandConfigurationError({
        reason: "Docker returned invalid JSON metadata.",
      }),
  })
})

export const localDocker = Effect.fn("localDocker")(function* (
  env: NodeJS.ProcessEnv,
) {
  if (
    (env.DOCKER_HOST && env.DOCKER_CONTEXT) ||
    env.DOCKER_TLS_VERIFY ||
    env.DOCKER_CERT_PATH
  ) {
    return yield* new CommandConfigurationError({
      reason:
        "Docker target overrides are conflicting or require unsupported TLS configuration. Select a local engine explicitly; repository commands never change contexts or discard overrides.",
    })
  }
  yield* dockerCommand(["--version"], env)
  yield* dockerCommand(["compose", "version", "--short"], env)
  const help = yield* dockerCommand(["compose", "up", "--help"], env)
  if (!help?.includes("--wait-timeout") || !help.includes("--no-recreate")) {
    return yield* new CommandConfigurationError({
      reason:
        "Docker Compose must support up --wait, --wait-timeout, and --no-recreate. Update Compose outside this command.",
    })
  }
  const context = yield* dockerCommand(["context", "show"], env)
  if (!context) {
    return yield* new CommandConfigurationError({
      reason: "Docker has no effective context.",
    })
  }
  const endpoint = yield* Schema.decodeUnknownEffect(Schema.String)(
    yield* dockerJson(
      [
        "context",
        "inspect",
        context,
        "--format",
        "{{json .Endpoints.docker.Host}}",
      ],
      env,
    ),
  ).pipe(
    Effect.mapError(
      () =>
        new CommandConfigurationError({
          reason: "Docker context endpoint metadata is invalid.",
        }),
    ),
  )
  if (
    (!endpoint.startsWith("unix:///") &&
      !endpoint.startsWith("npipe:////./pipe/")) ||
    (env.DOCKER_HOST && env.DOCKER_HOST !== endpoint)
  ) {
    return yield* new CommandConfigurationError({
      reason:
        "Refusing a remote or ambiguous Docker endpoint. Choose a local socket context explicitly; DOCKER_HOST must not silently redirect it.",
    })
  }
  // Pin this invocation to the context that was inspected, without switching
  // the user's global context or silently discarding a conflicting override.
  const pinned: NodeJS.ProcessEnv = { ...env, DOCKER_CONTEXT: context }
  const engine = yield* dockerCommand(["info", "--format", "{{.ID}}"], pinned)
  if (!engine) {
    return yield* new CommandConfigurationError({
      reason: "Docker engine identity is unavailable.",
    })
  }
  return { env: pinned, context, engine }
})

export function composeArgs(
  config: LocalInfrastructure,
  args: readonly string[],
) {
  return [
    "compose",
    "--project-directory",
    config.root,
    "--file",
    `${config.root}/compose.yaml`,
    "--project-name",
    config.project,
    ...args,
  ]
}

export function composeEnvironment(
  config: LocalInfrastructure,
  env: NodeJS.ProcessEnv,
) {
  return {
    ...env,
    FLOWMARK_INFRA_CHECKOUT: config.checkout,
    FLOWMARK_POSTGRES_PORT: String(config.port),
    COMPOSE_DISABLE_ENV_FILE: "1",
  }
}
