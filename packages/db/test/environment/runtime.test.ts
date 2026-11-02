import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { test } from "node:test"
import { fileURLToPath } from "node:url"
import { Effect, Result } from "effect"
import { readLocalDevelopmentDatabaseUrl } from "../../src/environment/local-database.js"
import { assertMigrationTarget } from "../../src/environment/migration-target.js"
import {
  assertLocalDevelopmentDatabase,
  isDemoModeEnabled,
  isLoopbackDatabaseUrl,
  isProductionEnvironment,
  readDatabaseUrl,
  readMigrationDatabaseUrl,
} from "../../src/environment/runtime.js"
const leftReason = <A>(
  effect: Effect.Effect<
    A,
    {
      readonly reason: string
    }
  >,
) =>
  Result.match(Effect.runSync(Effect.result(effect)), {
    onFailure: (error) => error.reason,
    onSuccess: () => {
      throw new Error("expected a typed command failure")
    },
  })

test("bare migrate allows loopback but refuses remote and malformed URLs safely", () => {
  for (const host of ["localhost", "127.0.0.1", "[::1]"]) {
    Effect.runSync(assertMigrationTarget(`postgresql://${host}/flowmark`, {}))
  }
  for (const host of ["ep-fake.neon.tech", "db.example.invalid"]) {
    const reason = leftReason(
      assertMigrationTarget(`postgresql://user:secret@${host}/flowmark`, {}),
    )
    assert.match(reason, /non-loopback/)
    assert.doesNotMatch(reason, /secret|postgresql:\/\//)
  }
  assert.match(
    leftReason(assertMigrationTarget("secret-invalid-url", {})),
    /invalid/,
  )
  assert.match(
    leftReason(assertMigrationTarget("https://localhost/db", {})),
    /PostgreSQL/,
  )
})

test("hosted migrate requires a matching wrapper, branch, direct host, and migration URL", () => {
  const url = "postgresql://user:secret@ep-fake.neon.tech/flowmark"
  for (const wrapper of ["production", "preview", "staging"]) {
    const env = {
      DATABASE_MIGRATION_URL: url,
      FLOWMARK_MIGRATION_WRAPPER: wrapper,
      FLOWMARK_MIGRATION_TARGET_HOST: "ep-fake.neon.tech",
      NEON_BRANCH: wrapper,
    }
    Effect.runSync(assertMigrationTarget(url, env))
    for (const override of [
      { FLOWMARK_MIGRATION_WRAPPER: "unknown" },
      { FLOWMARK_MIGRATION_TARGET_HOST: undefined },
      { FLOWMARK_MIGRATION_TARGET_HOST: "ep-other.neon.tech" },
      { NEON_BRANCH: "wrong" },
      { DATABASE_MIGRATION_URL: undefined },
    ]) {
      assert.match(
        leftReason(assertMigrationTarget(url, { ...env, ...override })),
        /Refusing migrate/,
      )
    }
    for (const host of ["db.example.invalid", "ep-fake-pooler.neon.tech"]) {
      const otherUrl = `postgresql://user:secret@${host}/flowmark`
      assert.match(
        leftReason(
          assertMigrationTarget(otherUrl, {
            ...env,
            DATABASE_MIGRATION_URL: otherUrl,
            FLOWMARK_MIGRATION_TARGET_HOST: host,
          }),
        ),
        /direct Neon host/,
      )
    }
  }
})

test("detects production from NODE_ENV or VERCEL_ENV", () => {
  assert.equal(isProductionEnvironment({}), false)
  assert.equal(isProductionEnvironment({ NODE_ENV: "development" }), false)
  assert.equal(isProductionEnvironment({ NODE_ENV: "production" }), true)
  assert.equal(isProductionEnvironment({ VERCEL_ENV: "production" }), true)
  assert.equal(isProductionEnvironment({ VERCEL_ENV: "preview" }), false)
})

test("treats only an explicit true flag as demo mode", () => {
  assert.equal(isDemoModeEnabled({}), false)
  assert.equal(isDemoModeEnabled({ FLOWMARK_DEMO_MODE: "false" }), false)
  assert.equal(isDemoModeEnabled({ FLOWMARK_DEMO_MODE: "true" }), true)
})

test("accepts loopback database hosts and rejects hosted hosts", () => {
  assert.equal(
    isLoopbackDatabaseUrl("postgresql://localhost:5432/flowmark"),
    true,
  )
  assert.equal(
    isLoopbackDatabaseUrl("postgresql://127.0.0.1:5432/flowmark"),
    true,
  )
  assert.equal(isLoopbackDatabaseUrl("postgresql://[::1]:5432/flowmark"), true)
  assert.equal(
    isLoopbackDatabaseUrl("postgresql://ep-example.neon.tech/flowmark"),
    false,
  )
})

test("prefers DATABASE_MIGRATION_URL for migrations", () => {
  assert.equal(
    Effect.runSync(
      readMigrationDatabaseUrl({
        DATABASE_URL: "postgresql://localhost:5432/runtime",
        DATABASE_MIGRATION_URL: "postgresql://localhost:5432/migration",
      }),
    ),
    "postgresql://localhost:5432/migration",
  )
  assert.equal(
    Effect.runSync(
      readMigrationDatabaseUrl({
        DATABASE_URL: "postgresql://localhost:5432/runtime",
      }),
    ),
    "postgresql://localhost:5432/runtime",
  )
  assert.match(
    leftReason(readMigrationDatabaseUrl({})),
    /DATABASE_MIGRATION_URL/,
  )
  assert.match(leftReason(readDatabaseUrl({})), /DATABASE_URL/)
})

test("refuses local seed and reset against production or non-loopback databases", () => {
  const local = "postgresql://localhost:5432/flowmark"
  assert.match(
    leftReason(
      assertLocalDevelopmentDatabase(local, {
        NODE_ENV: "production",
        FLOWMARK_DEMO_MODE: "true",
      }),
    ),
    /production environment/,
  )
  assert.match(
    leftReason(
      assertLocalDevelopmentDatabase(local, {
        VERCEL_ENV: "production",
        FLOWMARK_DEMO_MODE: "true",
      }),
    ),
    /production environment/,
  )
  assert.match(
    leftReason(assertLocalDevelopmentDatabase(local, {})),
    /FLOWMARK_DEMO_MODE/,
  )
  assert.match(
    leftReason(
      assertLocalDevelopmentDatabase("postgresql://db.example.com/flowmark", {
        FLOWMARK_DEMO_MODE: "true",
      }),
    ),
    /loopback/,
  )
  Effect.runSync(
    assertLocalDevelopmentDatabase(local, { FLOWMARK_DEMO_MODE: "true" }),
  )
})

test("db:setup sequence refuses a non-loopback migration URL when runtime URL is loopback", () => {
  const runtimeUrl = "postgresql://localhost:5432/flowmark"
  const remoteMigrationUrl = "postgresql://ep-fake.neon.tech/neondb"
  const env = {
    FLOWMARK_DEMO_MODE: "true",
    DATABASE_URL: runtimeUrl,
    DATABASE_MIGRATION_URL: remoteMigrationUrl,
  }

  Effect.runSync(assertLocalDevelopmentDatabase(runtimeUrl, env))
  assert.match(
    leftReason(
      assertLocalDevelopmentDatabase(
        Effect.runSync(readMigrationDatabaseUrl(env)),
        env,
      ),
    ),
    /loopback/,
  )
})

test("local setup and Studio reject different hosts, ports, databases, and roles", () => {
  const runtime =
    "postgresql://flowmark:local_dev_only@127.0.0.1:55432/flowmark"
  for (const migration of [
    "postgresql://flowmark:local_dev_only@localhost:55432/flowmark",
    "postgresql://flowmark:local_dev_only@127.0.0.1:55433/flowmark",
    "postgresql://flowmark:local_dev_only@127.0.0.1:55432/other",
    "postgresql://other:secret@127.0.0.1:55432/flowmark",
  ]) {
    const reason = leftReason(
      readLocalDevelopmentDatabaseUrl({
        FLOWMARK_DEMO_MODE: "true",
        DATABASE_URL: runtime,
        DATABASE_MIGRATION_URL: migration,
      }),
    )
    assert.match(reason, /must match DATABASE_URL/)
    assert.doesNotMatch(reason, /secret|postgresql:\/\//)
  }
})

test("local target selection keeps guards and redacts malformed URL errors", () => {
  const env = {
    FLOWMARK_DEMO_MODE: "true",
    DATABASE_URL:
      "postgresql://flowmark:local_dev_only@127.0.0.1:55432/flowmark",
  }
  for (const [override, message] of [
    [{ NODE_ENV: "production" }, /production environment/],
    [{ VERCEL_ENV: "production" }, /production environment/],
    [{ FLOWMARK_DEMO_MODE: "false" }, /FLOWMARK_DEMO_MODE/],
    [
      {
        DATABASE_MIGRATION_URL:
          "postgresql://local:secret@db.example.invalid/flowmark",
      },
      /loopback/,
    ],
    [{ DATABASE_URL: "secret-invalid-url" }, /invalid/],
    [{ DATABASE_MIGRATION_URL: "secret-invalid-url" }, /invalid/],
    [{ DATABASE_URL: "https://local:secret@localhost/flowmark" }, /PostgreSQL/],
    [
      { DATABASE_URL: "postgresql://%:secret@127.0.0.1:55432/flowmark" },
      /invalid/,
    ],
  ] as const) {
    const reason = leftReason(
      readLocalDevelopmentDatabaseUrl({ ...env, ...override }),
    )
    assert.match(reason, message)
    assert.doesNotMatch(reason, /secret|postgresql:\/\//)
  }
})

test("Studio config refuses unsafe configuration before database access", () => {
  const runtime =
    "postgresql://flowmark:local_dev_only@127.0.0.1:55432/flowmark"
  const run = (overrides: NodeJS.ProcessEnv = {}) =>
    spawnSync(
      process.execPath,
      [
        "--import",
        "tsx",
        "--input-type=module",
        "-e",
        'import config from "./drizzle.studio.config.ts"; if (config.dbCredentials.url !== process.env.DATABASE_URL) process.exit(2); console.log("runtime target selected")',
      ],
      {
        cwd: fileURLToPath(new URL("../..", import.meta.url)),
        encoding: "utf8",
        timeout: 10000,
        env: {
          ...process.env,
          PATH: "/missing",
          DATABASE_URL: runtime,
          DATABASE_MIGRATION_URL: runtime,
          FLOWMARK_DEMO_MODE: "true",
          NODE_ENV: "development",
          VERCEL_ENV: "",
          ...overrides,
        },
      },
    )
  // A valid URL alone is insufficient: Docker ownership proof is mandatory.
  const missingDocker = run()
  assert.equal(missingDocker.status, 1)
  assert.match(missingDocker.stderr, /Docker CLI is missing/)
  for (const overrides of [
    {
      DATABASE_MIGRATION_URL:
        "postgresql://local:secret@db.example.invalid/flowmark",
    },
    { DATABASE_URL: "postgresql://local:secret@db.example.invalid/flowmark" },
    { DATABASE_MIGRATION_URL: "postgresql://local:secret@127.0.0.1:1/other" },
    { DATABASE_URL: "secret-invalid-url" },
    { NODE_ENV: "production" },
    { FLOWMARK_DEMO_MODE: "false" },
  ]) {
    const result = run(overrides)
    assert.equal(result.status, 1)
    assert.match(
      result.stderr,
      /Refusing|FLOWMARK_DEMO_MODE|must match DATABASE_URL|does not match/,
    )
    assert.doesNotMatch(result.stdout + result.stderr, /secret|postgresql:\/\//)
  }
})

test("Studio CLI prints an actionable, redacted refusal before starting", () => {
  const result = spawnSync("pnpm", ["db:studio"], {
    cwd: fileURLToPath(new URL("../..", import.meta.url)),
    encoding: "utf8",
    timeout: 10000,
    env: {
      ...process.env,
      DATABASE_URL:
        "postgresql://flowmark:local_dev_only@127.0.0.1:55432/flowmark",
      DATABASE_MIGRATION_URL:
        "postgresql://local:secret@db.example.invalid/flowmark",
      FLOWMARK_DEMO_MODE: "true",
      NODE_ENV: "development",
      VERCEL_ENV: "",
    },
  })
  assert.equal(result.status, 1)
  assert.match(result.stdout + result.stderr, /database must be on loopback/)
  assert.doesNotMatch(result.stdout + result.stderr, /secret|postgresql:\/\//)
})
