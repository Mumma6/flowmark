import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { test, type TestContext } from "node:test"
import { Effect, Result } from "effect"
import { runLocalInfrastructure } from "../../src/cli/infra.js"
import { CommandConfigurationError } from "../../src/environment/error.js"
import {
  localProject,
  readLocalInfrastructure,
} from "../../src/environment/local-infrastructure.js"
import { assertManagedLocalDatabase } from "../../src/environment/managed-local-database.js"
import { readLocalDevelopmentDatabaseUrl } from "../../src/environment/local-database.js"
import { readCheckedMigrationDatabaseUrl } from "../../src/environment/migration-database.js"
import { assertTestDatabaseTarget } from "../../src/environment/test-database.js"

const id = "a".repeat(64)
const defaults = {
  FLOWMARK_DEMO_MODE: "true",
  DATABASE_URL: "postgresql://flowmark:local_dev_only@127.0.0.1:55432/flowmark",
  FLOWMARK_POSTGRES_PORT: "55432",
}

const execute = <A>(effect: Effect.Effect<A, { readonly reason: string }>) =>
  Effect.runPromise(
    effect.pipe(Effect.mapError((error) => new Error(error.reason))),
  )

function fixture(t: TestContext, options: Record<string, unknown> = {}) {
  const root = mkdtempSync(join(tmpdir(), "flowmark-infra-test-"))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  mkdirSync(join(root, "bin"))
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    ...defaults,
    PATH: `${join(root, "bin")}:${process.env.PATH}`,
    FLOWMARK_INFRA_TEST_STATE: join(root, "state.json"),
    FLOWMARK_INFRA_TEST_CALLS: join(root, "calls.jsonl"),
  }
  for (const key of [
    "DATABASE_MIGRATION_URL",
    "TEST_DATABASE_URL",
    "FLOWMARK_TEST_DATABASE_SOURCE",
    "FLOWMARK_TEST_CONTAINER_ID",
    "FLOWMARK_TEST_RUN_ID",
    "FLOWMARK_TEST_PROJECT",
    "NODE_ENV",
    "VERCEL_ENV",
    "DOCKER_HOST",
    "DOCKER_CONTEXT",
    "DOCKER_TLS_VERIFY",
    "DOCKER_CERT_PATH",
    "COMPOSE_FILE",
    "COMPOSE_PROJECT_NAME",
    "COMPOSE_PROFILES",
    "COMPOSE_ENV_FILES",
  ]) {
    delete env[key]
  }
  const config = Effect.runSync(readLocalInfrastructure(env))
  const labels = {
    "com.docker.compose.project": config.project,
    "com.docker.compose.service": "postgres",
    "io.flowmark.checkout": config.checkout,
    "io.flowmark.purpose": "development-postgres",
  }
  const state = {
    present: true,
    volume: true,
    permission: false,
    endpoint: "unix:///tmp/fake-docker.sock",
    failUp: false,
    container: {
      Id: id,
      Config: {
        Image: "postgres:18-alpine",
        Labels: labels,
        Env: [
          "POSTGRES_USER=flowmark",
          "POSTGRES_DB=flowmark",
          "POSTGRES_PASSWORD=local_dev_only",
        ],
      },
      State: {
        Running: true,
        Status: "running",
        Health: { Status: "healthy" },
      },
      HostConfig: {
        PortBindings: {
          "5432/tcp": [{ HostIp: "127.0.0.1", HostPort: "55432" }],
        },
      },
      Mounts: [
        {
          Type: "volume",
          Name: config.volume,
          Destination: "/var/lib/postgresql",
        },
      ],
    },
    volumeLabels: { ...labels, "io.flowmark.postgres-major": "18" },
    ...options,
  }
  writeFileSync(env.FLOWMARK_INFRA_TEST_STATE!, JSON.stringify(state))
  // This executable never invokes Docker or opens a socket. It models the
  // command boundary and records every operation, including target pinning.
  writeFileSync(
    join(root, "bin/docker"),
    `#!${process.execPath}
const fs = require('node:fs');
const args = process.argv.slice(2);
const file = process.env.FLOWMARK_INFRA_TEST_STATE;
const state = JSON.parse(fs.readFileSync(file, 'utf8'));
fs.appendFileSync(process.env.FLOWMARK_INFRA_TEST_CALLS, JSON.stringify({args, context:process.env.DOCKER_CONTEXT, project:process.env.FLOWMARK_INFRA_CHECKOUT, envFile:process.env.COMPOSE_DISABLE_ENV_FILE})+'\\n');
const out = value => process.stdout.write(value);
const save = () => fs.writeFileSync(file, JSON.stringify(state));
const fail = message => { process.stderr.write(message); process.exit(1); };
if (args[0] === '--version') out('Docker test CLI');
else if (args[0] === 'context' && args[1] === 'show') out(process.env.DOCKER_CONTEXT || 'test-local');
else if (args[0] === 'context' && args[1] === 'inspect') out(JSON.stringify(state.endpoint));
else if (args[0] === 'info') { if(state.permission) fail('permission denied: secret-marker'); out('test-engine'); }
else if (args[0] === 'inspect') out(JSON.stringify(state.container));
else if (args[0] === 'volume') { if(!state.volume) fail('no such volume'); out(JSON.stringify(state.volumeLabels)); }
else if (args[0] === 'exec') out(state.sqlIdentity || 'flowmark:flowmark');
else if (args[0] === 'logs') { out('PostgreSQL log\\n'); process.stderr.write('connection postgresql://test:secret-marker@localhost/db'); }
else if (args[0] === 'compose' && args[1] === 'version') out('2.30.0');
else if (args[0] === 'compose' && args.includes('--help')) out(state.oldCompose ? '--help' : '--wait --wait-timeout --no-recreate');
else if (args[0] === 'compose' && args.includes('ps')) out(state.present ? state.container.Id : '');
else if (args[0] === 'compose' && args.includes('up')) { if(state.failUp) fail('startup failure secret-marker'); state.present=true; state.volume=true; state.container.State.Running=true; state.container.State.Status='running'; save(); }
else if (args[0] === 'compose' && args.includes('stop')) { state.container.State.Running=false; state.container.State.Status='exited'; save(); }
else if (args[0] === 'compose' && args.includes('restart')) { state.container.State.Running=true; save(); }
else fail('unexpected command');
`,
    { mode: 0o755 },
  )
  return {
    env,
    root,
    config,
    state,
    set: (value: unknown) =>
      writeFileSync(env.FLOWMARK_INFRA_TEST_STATE!, JSON.stringify(value)),
    calls: () =>
      existsSync(env.FLOWMARK_INFRA_TEST_CALLS!)
        ? readFileSync(env.FLOWMARK_INFRA_TEST_CALLS!, "utf8")
            .trim()
            .split("\n")
            .map(
              (line) =>
                JSON.parse(line) as {
                  args: string[]
                  context: string
                  envFile: string
                },
            )
        : [],
    run: (
      operation: string,
      args: string[] = [],
      overrides: NodeJS.ProcessEnv = {},
    ) =>
      execute(
        runLocalInfrastructure(
          operation,
          args,
          { ...env, ...overrides },
          () => Effect.void,
        ),
      ),
  }
}

const mutates = (args: string[]) =>
  (args.includes("up") && !args.includes("--help")) ||
  args.includes("stop") ||
  args.includes("restart")
const reason = async <A>(
  effect: Effect.Effect<A, { readonly reason: string }>,
) =>
  Result.match(await Effect.runPromise(Effect.result(effect)), {
    onFailure: (error) => error.reason,
    onSuccess: () => assert.fail("expected refusal"),
  })

test("integration target proof checks container ownership, transient storage, port and SQL identity", async (t) => {
  const f = fixture(t)
  const run = "b".repeat(32)
  const project = `flowmark-test-${run}`
  const url =
    "postgresql://flowmark_test:local_test_only@127.0.0.1:55555/flowmark_test"
  const container = {
    ...f.state.container,
    Config: {
      Image: "postgres:18-alpine",
      Labels: {
        "com.docker.compose.project": project,
        "com.docker.compose.service": "postgres-test",
        "io.flowmark.purpose": "integration-postgres",
        "io.flowmark.test-run": run,
      },
      Env: [
        "POSTGRES_USER=flowmark_test",
        "POSTGRES_DB=flowmark_test",
        "POSTGRES_PASSWORD=local_test_only",
      ],
    },
    HostConfig: { Tmpfs: { "/var/lib/postgresql": "size=512m" } },
    Mounts: [],
    NetworkSettings: {
      Ports: { "5432/tcp": [{ HostIp: "127.0.0.1", HostPort: "55555" }] },
    },
  }
  const state = {
    ...f.state,
    container,
    sqlIdentity: "flowmark_test:flowmark_test",
  }
  const env = {
    ...f.env,
    DATABASE_URL: url,
    TEST_DATABASE_URL: url,
    DATABASE_MIGRATION_URL: url,
    FLOWMARK_TEST_RUN_ID: run,
    FLOWMARK_TEST_PROJECT: project,
    FLOWMARK_TEST_CONTAINER_ID: id,
    FLOWMARK_TEST_DATABASE_SOURCE: "compose",
  }
  f.set(state)
  await execute(assertTestDatabaseTarget(env))
  for (const override of [
    {
      Config: {
        ...container.Config,
        Labels: {
          ...container.Config.Labels,
          "io.flowmark.test-run": "unrelated",
        },
      },
    },
    { Mounts: [{ Type: "volume" }] },
    { HostConfig: { Tmpfs: {} } },
    {
      NetworkSettings: {
        Ports: { "5432/tcp": [{ HostIp: "0.0.0.0", HostPort: "55555" }] },
      },
    },
    {
      NetworkSettings: {
        Ports: { "5432/tcp": [{ HostIp: "127.0.0.1", HostPort: "55556" }] },
      },
    },
    { State: { ...container.State, Running: false } },
  ]) {
    f.set({ ...state, container: { ...container, ...override } })
    await assert.rejects(
      execute(assertTestDatabaseTarget(env)),
      /Refusing integration/,
    )
  }
  f.set({ ...state, sqlIdentity: "flowmark:flowmark" })
  await assert.rejects(
    execute(assertTestDatabaseTarget(env)),
    /Refusing integration/,
  )
  assert.ok(!f.calls().some((call) => mutates(call.args)))
})

test("checkout projects are stable and independent", (t) => {
  const root = mkdtempSync(join(tmpdir(), "flowmark-projects-"))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  mkdirSync(join(root, "one"))
  mkdirSync(join(root, "two"))
  assert.deepEqual(
    localProject(join(root, "one")),
    localProject(join(root, "one")),
  )
  assert.notEqual(
    localProject(join(root, "one")).project,
    localProject(join(root, "two")).project,
  )
})

test("local commands require Compose proof without a provider selector", async (t) => {
  const f = fixture(t)
  for (const migration of [
    undefined,
    defaults.DATABASE_URL,
    "postgres://%66lowmark:different@127.0.0.1:55432/flowmark?application_name=migration",
  ]) {
    const env = { ...f.env, DATABASE_MIGRATION_URL: migration }
    assert.equal(
      await execute(readLocalDevelopmentDatabaseUrl(env)),
      defaults.DATABASE_URL,
    )
    assert.equal(
      await execute(readCheckedMigrationDatabaseUrl(true, env)),
      defaults.DATABASE_URL,
    )
  }
  f.state.present = false
  f.set(f.state)
  await assert.rejects(
    execute(readLocalDevelopmentDatabaseUrl(f.env)),
    /absent, stopped, or unhealthy/,
  )
  await assert.rejects(
    execute(readCheckedMigrationDatabaseUrl(false, f.env)),
    /absent, stopped, or unhealthy/,
  )
  assert.ok(!f.calls().some((call) => mutates(call.args)))
})

test("Studio selects the runtime URL after proving Compose ownership", (t) => {
  const f = fixture(t)
  const result = spawnSync(
    process.execPath,
    [
      "--import",
      "tsx",
      "--input-type=module",
      "-e",
      'import config from "./drizzle.studio.config.ts"; if (config.dbCredentials.url !== process.env.DATABASE_URL) process.exit(2)',
    ],
    {
      cwd: fileURLToPath(new URL("../..", import.meta.url)),
      encoding: "utf8",
      env: f.env,
    },
  )
  assert.equal(result.status, 0, result.stderr)
  assert.ok(f.calls().some((call) => call.args[0] === "exec"))
  assert.ok(!f.calls().some((call) => mutates(call.args)))
})

test("migration selection preserves disposable CI provenance without allowing local seed or migration", async () => {
  const url =
    "postgresql://flowmark_ci:local_ci_only@127.0.0.1:5432/flowmark_test"
  const env = {
    CI: "true",
    GITHUB_ACTIONS: "true",
    NODE_ENV: "test",
    FLOWMARK_TEST_DATABASE_SOURCE: "ci-service",
    TEST_DATABASE_URL: url,
    DATABASE_URL: url,
    DATABASE_MIGRATION_URL: url,
    PATH: "/missing",
  }
  assert.equal(await execute(readCheckedMigrationDatabaseUrl(false, env)), url)
  await assert.rejects(
    execute(readCheckedMigrationDatabaseUrl(true, env)),
    /FLOWMARK_DEMO_MODE/,
  )
  await assert.rejects(
    execute(readLocalDevelopmentDatabaseUrl(env)),
    /FLOWMARK_DEMO_MODE/,
  )
  await assert.rejects(
    execute(readCheckedMigrationDatabaseUrl(false, { ...env, CI: "false" })),
    /Refusing integration/,
  )
  await assert.rejects(
    execute(
      readCheckedMigrationDatabaseUrl(false, {
        ...env,
        TEST_DATABASE_URL: defaults.DATABASE_URL,
      }),
    ),
    /Refusing integration/,
  )
})

test("local migration cannot be redirected by hosted approval or a conflicting local override", async (t) => {
  const f = fixture(t)
  const url = "postgresql://secret@ep-fake.neon.tech/flowmark"
  await assert.rejects(
    execute(
      readCheckedMigrationDatabaseUrl(true, {
        ...f.env,
        DATABASE_MIGRATION_URL: url,
        FLOWMARK_MIGRATION_WRAPPER: "preview",
        NEON_BRANCH: "preview",
        FLOWMARK_MIGRATION_TARGET_HOST: "ep-fake.neon.tech",
      }),
    ),
    /Refusing local migrate/,
  )
  await assert.rejects(
    execute(
      readCheckedMigrationDatabaseUrl(true, {
        ...f.env,
        DATABASE_MIGRATION_URL: defaults.DATABASE_URL.replace(
          "/flowmark",
          "/other",
        ),
      }),
    ),
    /must match DATABASE_URL/,
  )
  assert.equal(f.calls().length, 0)
})

test("config refuses wrong targets and ambient Compose overrides before Docker", async (t) => {
  const f = fixture(t)
  for (const override of [
    {
      DATABASE_URL:
        "postgresql://flowmark:secret-marker@ep-fake.neon.tech/flowmark",
    },
    {
      DATABASE_URL:
        "postgresql://flowmark:local_dev_only@127.0.0.1:55432/other",
    },
    { DATABASE_URL: defaults.DATABASE_URL + "?options=secret-marker" },
    {
      DATABASE_MIGRATION_URL:
        "postgresql://flowmark:secret-marker@db.example.invalid/flowmark",
    },
    { FLOWMARK_POSTGRES_PORT: "-1" },
    { FLOWMARK_POSTGRES_PORT: "55433" },
    { COMPOSE_PROJECT_NAME: "unrelated" },
    { COMPOSE_FILE: "other.yaml" },
    { COMPOSE_PROFILES: "test" },
    { COMPOSE_REMOVE_ORPHANS: "1" },
    { NODE_ENV: "production" },
  ]) {
    await assert.rejects(
      f.run("up", [], override),
      (error) => !String(error).includes("secret-marker"),
    )
  }
  assert.equal(f.calls().length, 0)
})

test("remote Docker endpoints and target overrides never reach engine mutation", async (t) => {
  for (const endpoint of ["ssh://remote", "tcp://127.0.0.1:2375"]) {
    const f = fixture(t, { endpoint })
    await assert.rejects(f.run("up"), /remote or ambiguous/)
    assert.ok(
      !f.calls().some((call) => call.args[0] === "info" || mutates(call.args)),
    )
  }
  const f = fixture(t)
  for (const env of [
    { DOCKER_HOST: "unix:///other.sock" },
    { DOCKER_HOST: "unix:///tmp/fake-docker.sock", DOCKER_CONTEXT: "other" },
    { DOCKER_TLS_VERIFY: "1" },
  ]) {
    await assert.rejects(f.run("up", [], env))
  }
  assert.ok(!f.calls().some((call) => mutates(call.args)))
})

test("permission denial, old Compose, and missing CLI produce safe failures", async (t) => {
  for (const options of [{ permission: true }, { oldCompose: true }]) {
    const f = fixture(t, options)
    const result = await reason(
      runLocalInfrastructure("up", [], f.env, () => Effect.void),
    )
    assert.match(result, /socket access was denied|Compose must support/)
    assert.doesNotMatch(result, /secret-marker/)
    assert.ok(!f.calls().some((call) => mutates(call.args)))
  }
  const f = fixture(t)
  assert.match(
    await reason(
      runLocalInfrastructure(
        "up",
        [],
        { ...f.env, PATH: "/missing" },
        () => Effect.void,
      ),
    ),
    /CLI is missing/,
  )
})

test("already running infrastructure is identified without restart or ownership claim", async (t) => {
  const f = fixture(t)
  const result = await f.run("up")
  assert.equal(result.startedByThisCall, false)
  assert.equal(result.container, id)
  assert.ok(!f.calls().some((call) => mutates(call.args)))
  assert.ok(
    f
      .calls()
      .filter((call) => call.args[0] === "info" || call.args[0] === "inspect")
      .every((call) => call.context === "test-local"),
  )
  assert.equal((await f.run("doctor")).healthy, "healthy")
  assert.equal((await f.run("doctor", ["--require-ready"])).databaseReady, true)
})

test("explicit recreation keeps the owned volume and does not claim a previously running service", async (t) => {
  const f = fixture(t)
  const result = await f.run("up", ["--recreate"])
  assert.equal(result.startedByThisCall, false)
  const up = f.calls().find((call) => mutates(call.args))!
  assert.ok(up.args.includes("--force-recreate"))
  assert.equal(up.args.at(-1), "postgres")
  assert.ok(
    !f
      .calls()
      .some((call) => call.args.includes("-v") || call.args.includes("rm")),
  )
})

test("new startup scopes one service, waits, and preserves volume on stop/start", async (t) => {
  const f = fixture(t, { present: false, volume: false })
  await assert.rejects(
    f.run("doctor", ["--require-ready"]),
    /absent, stopped, or unhealthy/,
  )
  assert.ok(!f.calls().some((call) => mutates(call.args)))
  const started = await f.run("up")
  assert.equal(started.startedByThisCall, true)
  const up = f.calls().find((call) => mutates(call.args))!
  assert.equal(up.args.at(-1), "postgres")
  for (const flag of [
    "--wait",
    "--wait-timeout",
    "--no-recreate",
    "--project-name",
    "--file",
  ]) {
    assert.ok(up.args.includes(flag))
  }
  assert.equal(up.envFile, "1")
  await f.run("down", ["--container", id])
  const state = JSON.parse(
    readFileSync(f.env.FLOWMARK_INFRA_TEST_STATE!, "utf8"),
  )
  assert.equal(state.volume, true)
  assert.equal(state.container.State.Running, false)
  assert.equal((await f.run("up")).startedByThisCall, true)
  assert.ok(
    !f
      .calls()
      .some(
        (call) =>
          call.args.includes("down") ||
          call.args.includes("-v") ||
          call.args.includes("rm") ||
          call.args.includes("prune"),
      ),
  )
})

test("foreign resources, wrong bindings, and unlabeled volumes refuse takeover", async (t) => {
  for (const alteration of ["labels", "port", "volume", "image", "sql"]) {
    const f = fixture(t)
    if (alteration === "labels") {
      f.state.container.Config.Labels["io.flowmark.checkout"] = "foreign"
    }
    if (alteration === "port") {
      f.state.container.HostConfig.PortBindings["5432/tcp"][0].HostIp =
        "0.0.0.0"
    }
    if (alteration === "volume") {
      f.state.container.Mounts[0].Name = "foreign-volume"
    }
    if (alteration === "image") {
      f.state.container.Config.Image = "postgres:17-alpine"
    }
    f.set({
      ...f.state,
      ...(alteration === "sql" ? { sqlIdentity: "other:other" } : {}),
    })
    await assert.rejects(f.run("up"), /identity does not match/)
    assert.ok(!f.calls().some((call) => mutates(call.args)))
  }
  const f = fixture(t, { present: false, volumeLabels: null })
  await assert.rejects(f.run("up"), /identity does not match/)
  assert.ok(!f.calls().some((call) => mutates(call.args)))
})

test("port failures and bad service arguments cannot mutate infrastructure", async (t) => {
  const f = fixture(t, { present: false, volume: false })
  await assert.rejects(
    execute(
      runLocalInfrastructure("up", [], f.env, () =>
        Effect.fail(new CommandConfigurationError({ reason: "port occupied" })),
      ),
    ),
    /port occupied/,
  )
  await assert.rejects(f.run("restart", ["unrelated"]))
  await assert.rejects(f.run("down", ["--volumes"]))
  assert.ok(!f.calls().some((call) => mutates(call.args)))
})

test("unhealthy state, failed startup, and stale stop ownership are explicit failures", async (t) => {
  const unhealthy = fixture(t)
  unhealthy.state.container.State.Health.Status = "unhealthy"
  unhealthy.set(unhealthy.state)
  await assert.rejects(unhealthy.run("doctor"), /unhealthy/)
  assert.ok(!unhealthy.calls().some((call) => mutates(call.args)))
  const failed = fixture(t, { present: false, volume: false, failUp: true })
  await assert.rejects(failed.run("up"), /Docker command failed/)
  const f = fixture(t)
  await assert.rejects(
    f.run("down", ["--container", "b".repeat(64)]),
    /no longer matches/,
  )
  assert.ok(!f.calls().some((call) => mutates(call.args)))
})

test("logs are bounded, include stderr, and redact connection URLs", async (t) => {
  const f = fixture(t)
  const result = await f.run("logs")
  assert.match(String((result as { logs?: string }).logs), /PostgreSQL log/)
  assert.doesNotMatch(
    String((result as { logs?: string }).logs),
    /secret-marker/,
  )
  const logs = f.calls().find((call) => call.args[0] === "logs")!
  assert.deepEqual(logs.args, ["logs", "--tail", "100", id])
})

test("managed database guards always check Compose ownership before use", async (t) => {
  const f = fixture(t)
  await Effect.runPromise(
    assertManagedLocalDatabase(defaults.DATABASE_URL, f.env),
  )
  f.state.container.Config.Labels["io.flowmark.checkout"] = "foreign"
  f.set(f.state)
  await assert.rejects(
    execute(assertManagedLocalDatabase(defaults.DATABASE_URL, f.env)),
    /identity does not match/,
  )
})
