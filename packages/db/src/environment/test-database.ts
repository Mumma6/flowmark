import process from "node:process"
import { Effect, Schema } from "effect"
import { CommandConfigurationError } from "./error.js"
import { dockerCommand, dockerJson, localDocker } from "./local-docker.js"

const Labels = Schema.Record(Schema.String, Schema.String)
const TestContainer = Schema.Struct({
  Id: Schema.String,
  Config: Schema.Struct({
    Image: Schema.String,
    Labels: Schema.NullOr(Labels),
    Env: Schema.Array(Schema.String),
  }),
  State: Schema.Struct({
    Running: Schema.Boolean,
    Health: Schema.optional(Schema.Struct({ Status: Schema.String })),
  }),
  HostConfig: Schema.Struct({
    Tmpfs: Schema.optional(Schema.Record(Schema.String, Schema.String)),
  }),
  Mounts: Schema.Array(Schema.Struct({ Type: Schema.String })),
  NetworkSettings: Schema.Struct({
    Ports: Schema.Record(
      Schema.String,
      Schema.NullOr(
        Schema.Array(
          Schema.Struct({ HostIp: Schema.String, HostPort: Schema.String }),
        ),
      ),
    ),
  }),
})

const refusal = () =>
  new CommandConfigurationError({
    reason:
      "Refusing integration database access: expected an owned disposable PostgreSQL test instance or the explicit Actions service target. Use pnpm test:integration; never development/demo or hosted databases.",
  })

const testProof = Effect.fn("testProof")(function* (env: NodeJS.ProcessEnv) {
  const run = env.FLOWMARK_TEST_RUN_ID
  const project = env.FLOWMARK_TEST_PROJECT
  const id = env.FLOWMARK_TEST_CONTAINER_ID
  if (
    !run ||
    !/^[a-f0-9]{32}$/.test(run) ||
    project !== `flowmark-test-${run}` ||
    !id ||
    !/^[a-f0-9]{64}$/.test(id)
  ) {
    return yield* refusal()
  }
  return { run, project, id }
})

export const inspectTestContainer = Effect.fn("inspectTestContainer")(
  function* (env: NodeJS.ProcessEnv, requireReady: boolean = true) {
    const { run, project, id } = yield* testProof(env)
    const container = yield* Schema.decodeUnknownEffect(TestContainer)(
      yield* dockerJson(["inspect", id, "--format", "{{json .}}"], env),
    ).pipe(Effect.mapError(refusal))
    const labels = container.Config.Labels
    if (
      container.Id !== id ||
      labels?.["com.docker.compose.project"] !== project ||
      labels?.["com.docker.compose.service"] !== "postgres-test" ||
      labels?.["io.flowmark.purpose"] !== "integration-postgres" ||
      labels?.["io.flowmark.test-run"] !== run ||
      container.Config.Image !== "postgres:18-alpine" ||
      !Object.hasOwn(container.HostConfig.Tmpfs ?? {}, "/var/lib/postgresql") ||
      container.Mounts.some((mount) => mount.Type !== "tmpfs") ||
      ![
        "POSTGRES_USER=flowmark_test",
        "POSTGRES_DB=flowmark_test",
        "POSTGRES_PASSWORD=local_test_only",
      ].every((value) => container.Config.Env.includes(value))
    ) {
      return yield* refusal()
    }
    if (
      requireReady &&
      (!container.State.Running || container.State.Health?.Status !== "healthy")
    ) {
      return yield* refusal()
    }
    return container
  },
)

export const assertTestDatabaseTarget = Effect.fn("assertTestDatabaseTarget")(
  function* (env: NodeJS.ProcessEnv = process.env) {
    if (!env.TEST_DATABASE_URL) {
      return yield* refusal()
    }
    const target = yield* Effect.try({
      try: () => new URL(env.TEST_DATABASE_URL!),
      catch: refusal,
    })
    const ci = env.FLOWMARK_TEST_DATABASE_SOURCE === "ci-service"
    if (
      !["postgres:", "postgresql:"].includes(target.protocol) ||
      target.hostname !== "127.0.0.1" ||
      target.pathname !== "/flowmark_test" ||
      target.search ||
      target.hash ||
      env.DATABASE_URL !== env.TEST_DATABASE_URL ||
      env.DATABASE_MIGRATION_URL !== env.TEST_DATABASE_URL ||
      env.NODE_ENV === "production" ||
      env.VERCEL_ENV === "production" ||
      env.FLOWMARK_MIGRATION_WRAPPER ||
      env.FLOWMARK_MIGRATION_APPROVED
    ) {
      return yield* refusal()
    }
    if (ci) {
      if (
        env.GITHUB_ACTIONS !== "true" ||
        env.CI !== "true" ||
        target.username !== "flowmark_ci" ||
        target.password !== "local_ci_only" ||
        Number(target.port || "5432") !== 5432 ||
        env.FLOWMARK_TEST_CONTAINER_ID ||
        env.FLOWMARK_TEST_RUN_ID
      ) {
        return yield* refusal()
      }
      return
    }
    if (
      env.FLOWMARK_TEST_DATABASE_SOURCE !== "compose" ||
      target.username !== "flowmark_test" ||
      target.password !== "local_test_only" ||
      !target.port
    ) {
      return yield* refusal()
    }
    yield* testProof(env)
    const docker = yield* localDocker(env)
    const container = yield* inspectTestContainer(docker.env)
    const ports = container.NetworkSettings.Ports["5432/tcp"]
    if (
      ports?.length !== 1 ||
      ports[0].HostIp !== "127.0.0.1" ||
      ports[0].HostPort !== target.port
    ) {
      return yield* refusal()
    }
    const identity = yield* dockerCommand(
      [
        "exec",
        container.Id,
        "sh",
        "-c",
        'PGPASSWORD="$POSTGRES_PASSWORD" exec psql -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "SELECT current_database() || chr(58) || current_user"',
      ],
      docker.env,
    )
    if (identity !== "flowmark_test:flowmark_test") {
      return yield* refusal()
    }
  },
)

export const validateOptionalTestDatabase = Effect.fn(
  "validateOptionalTestDatabase",
)(function* (env: NodeJS.ProcessEnv = process.env) {
  if (env.TEST_DATABASE_URL) {
    yield* assertTestDatabaseTarget(env)
  }
})
