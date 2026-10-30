import assert from "node:assert/strict"
import { test } from "node:test"
import { Effect, Result } from "effect"
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
