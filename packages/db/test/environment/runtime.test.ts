import assert from "node:assert/strict"
import { test } from "node:test"
import { Effect, Either } from "effect"
import {
  assertLocalDevelopmentDatabase,
  isDemoModeEnabled,
  isLoopbackDatabaseUrl,
  isProductionEnvironment,
  readDatabaseUrl,
  readMigrationDatabaseUrl,
} from "../../src/environment/runtime.js"

const leftReason = <A>(
  effect: Effect.Effect<A, { readonly reason: string }>,
) =>
  Either.match(Effect.runSync(Effect.either(effect)), {
    onLeft: (error) => error.reason,
    onRight: () => {
      throw new Error("expected a typed command failure")
    },
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
