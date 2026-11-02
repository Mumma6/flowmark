import process from "node:process"
import { Effect, Schema } from "effect"
import { CommandConfigurationError } from "./error.js"
import {
  composeArgs,
  composeEnvironment,
  dockerCommand,
  dockerJson,
  localDocker,
} from "./local-docker.js"
import {
  localDatabaseMode,
  readLocalInfrastructure,
  type LocalInfrastructure,
} from "./local-infrastructure.js"

const Labels = Schema.Record(Schema.String, Schema.String)
const Container = Schema.Struct({
  Id: Schema.String,
  Config: Schema.Struct({
    Image: Schema.String,
    Labels: Schema.NullOr(Labels),
    Env: Schema.Array(Schema.String),
  }),
  State: Schema.Struct({
    Running: Schema.Boolean,
    Status: Schema.String,
    Health: Schema.optional(Schema.Struct({ Status: Schema.String })),
  }),
  HostConfig: Schema.Struct({
    PortBindings: Schema.NullOr(
      Schema.Record(
        Schema.String,
        Schema.NullOr(
          Schema.Array(
            Schema.Struct({ HostIp: Schema.String, HostPort: Schema.String }),
          ),
        ),
      ),
    ),
  }),
  Mounts: Schema.Array(
    Schema.Struct({
      Type: Schema.String,
      Name: Schema.optional(Schema.String),
      Destination: Schema.String,
    }),
  ),
})

const invalidIdentity = () =>
  new CommandConfigurationError({
    reason:
      "Container or volume identity does not match this checkout's PostgreSQL configuration. Refusing takeover, restart, stop, or database access. Inspect manually; do not delete existing data.",
  })

export const inspectLocalVolume = Effect.fn("inspectLocalVolume")(function* (
  config: LocalInfrastructure,
  env: NodeJS.ProcessEnv,
) {
  const metadata = yield* dockerJson(
    ["volume", "inspect", config.volume, "--format", "{{json .Labels}}"],
    env,
    true,
  )
  if (metadata === undefined) {
    return false
  }
  const labels = yield* Schema.decodeUnknownEffect(Labels)(metadata).pipe(
    Effect.mapError(invalidIdentity),
  )
  if (
    labels["io.flowmark.checkout"] !== config.checkout ||
    labels["io.flowmark.purpose"] !== "development-postgres" ||
    labels["io.flowmark.postgres-major"] !== "18" ||
    labels["com.docker.compose.project"] !== config.project
  ) {
    return yield* invalidIdentity()
  }
  return true
})

export const inspectLocalContainer = Effect.fn("inspectLocalContainer")(
  function* (config: LocalInfrastructure, env: NodeJS.ProcessEnv) {
    const ids = yield* dockerCommand(
      composeArgs(config, ["ps", "--all", "--quiet", "postgres"]),
      composeEnvironment(config, env),
    )
    if (!ids) {
      return null
    }
    if (!/^[a-f0-9]{12,64}$/.test(ids)) {
      return yield* invalidIdentity()
    }
    const container = yield* Schema.decodeUnknownEffect(Container)(
      yield* dockerJson(["inspect", ids, "--format", "{{json .}}"], env),
    ).pipe(Effect.mapError(invalidIdentity))
    const labels = container.Config.Labels
    const ports = container.HostConfig.PortBindings?.["5432/tcp"]
    const mounts = container.Mounts.filter(
      (mount) => mount.Destination === "/var/lib/postgresql",
    )
    if (
      container.Id !== ids ||
      labels?.["com.docker.compose.project"] !== config.project ||
      labels?.["com.docker.compose.service"] !== "postgres" ||
      labels?.["io.flowmark.checkout"] !== config.checkout ||
      labels?.["io.flowmark.purpose"] !== "development-postgres" ||
      container.Config.Image !== "postgres:18-alpine" ||
      ![
        "POSTGRES_USER=flowmark",
        "POSTGRES_DB=flowmark",
        "POSTGRES_PASSWORD=local_dev_only",
      ].every((value) => container.Config.Env.includes(value)) ||
      ports?.length !== 1 ||
      ports[0].HostIp !== "127.0.0.1" ||
      ports[0].HostPort !== String(config.port) ||
      mounts.length !== 1 ||
      mounts[0].Type !== "volume" ||
      mounts[0].Name !== config.volume
    ) {
      return yield* invalidIdentity()
    }
    if (!(yield* inspectLocalVolume(config, env))) {
      return yield* invalidIdentity()
    }
    return container
  },
)

export const assertLocalContainerReady = Effect.fn("assertLocalContainerReady")(
  function* (config: LocalInfrastructure, env: NodeJS.ProcessEnv) {
    const container = yield* inspectLocalContainer(config, env)
    if (
      !container?.State.Running ||
      container.State.Health?.Status !== "healthy"
    ) {
      return yield* new CommandConfigurationError({
        reason:
          "This checkout's PostgreSQL is absent, stopped, or unhealthy. Run pnpm infra up, then inspect pnpm infra status / pnpm infra logs. Container health does not prove migrations are current.",
      })
    }
    const identity = yield* dockerCommand(
      [
        "exec",
        container.Id,
        "sh",
        "-c",
        'PGPASSWORD="$POSTGRES_PASSWORD" exec psql -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "SELECT current_database() || chr(58) || current_user"',
      ],
      env,
    )
    if (identity !== "flowmark:flowmark") {
      return yield* invalidIdentity()
    }
    return container
  },
)

export const assertManagedLocalDatabase = Effect.fn(
  "assertManagedLocalDatabase",
)(function* (url: string, env: NodeJS.ProcessEnv = process.env) {
  if ((yield* localDatabaseMode(env)) === "native") {
    return
  }
  const config = yield* readLocalInfrastructure({ ...env, DATABASE_URL: url })
  const docker = yield* localDocker(env)
  yield* assertLocalContainerReady(config, docker.env)
})
