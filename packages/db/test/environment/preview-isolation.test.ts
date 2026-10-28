import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"
import { Effect, Either, Option } from "effect"
import {
  committedMigrationHash,
  decidePreviewBaseline,
} from "../../src/environment/preview-baseline.js"
import {
  assertPreviewAuthOrigins,
  assertPreviewDashboardApi,
  assertPreviewDatabase,
  isProductionPublicHost,
} from "../../src/environment/preview-isolation.js"

const migrationsFolder = fileURLToPath(
  new URL("../../migrations", import.meta.url),
)

const leftReason = <A>(effect: Effect.Effect<A, { readonly reason: string }>) =>
  Either.match(Effect.runSync(Effect.either(effect)), {
    onLeft: (error) => error.reason,
    onRight: () => {
      throw new Error("expected a typed command failure")
    },
  })

test("recognises production public hosts", () => {
  assert.equal(isProductionPublicHost("api.flowmark.dev"), true)
  assert.equal(isProductionPublicHost("app.flowmark.dev"), true)
  assert.equal(isProductionPublicHost("ep-fake.neon.tech"), false)
})

test("preview database access requires the preview branch marker and a Neon host", () => {
  Effect.runSync(
    assertPreviewDatabase("postgresql://user:secret@ep-prod.neon.tech/db", {
      VERCEL_ENV: "production",
    }),
  )
  assert.match(
    leftReason(
      assertPreviewDatabase("postgresql://user:secret@ep-fake.neon.tech/db", {
        VERCEL_ENV: "preview",
      }),
    ),
    /FLOWMARK_DATABASE_BRANCH/,
  )
  const hosted = leftReason(
    assertPreviewDatabase("postgresql://user:secret@ep-fake.example.com/db", {
      VERCEL_ENV: "preview",
      FLOWMARK_DATABASE_BRANCH: "preview",
    }),
  )
  assert.match(hosted, /ep-fake\.example\.com/)
  assert.equal(hosted.includes("secret"), false)
  Effect.runSync(
    assertPreviewDatabase("postgresql://user:secret@ep-preview.neon.tech/db", {
      VERCEL_ENV: "preview",
      FLOWMARK_DATABASE_BRANCH: "preview",
    }),
  )
})

test("preview auth and dashboard origins reject production hosts", () => {
  assert.match(
    leftReason(
      assertPreviewAuthOrigins({
        VERCEL_ENV: "preview",
        BETTER_AUTH_URL: "https://app.flowmark.dev",
        FLOWMARK_DASHBOARD_ORIGIN: "https://app.flowmark.dev",
      }),
    ),
    /app\.flowmark\.dev/,
  )
  assert.match(
    leftReason(
      assertPreviewDashboardApi("https://api.flowmark.dev", {
        VERCEL_ENV: "preview",
      }),
    ),
    /api\.flowmark\.dev/,
  )
  Effect.runSync(
    assertPreviewDashboardApi("https://preview.example", {
      VERCEL_ENV: "preview",
    }),
  )
  Effect.runSync(
    assertPreviewAuthOrigins({
      VERCEL_ENV: "production",
      BETTER_AUTH_URL: "https://app.flowmark.dev",
      FLOWMARK_DASHBOARD_ORIGIN: "https://app.flowmark.dev",
    }),
  )
})

test("preview baseline stamps an empty schema and refuses existing rows", () => {
  assert.equal(
    Option.isNone(
      Effect.runSync(
        decidePreviewBaseline({
          userTableExists: true,
          workflowsTableExists: true,
          userRowCount: 0,
          workflowRowCount: 0,
          migrationRowCount: 0,
        }),
      ),
    ),
    true,
  )
  assert.equal(
    Option.isSome(
      Effect.runSync(
        decidePreviewBaseline({
          userTableExists: false,
          workflowsTableExists: false,
          userRowCount: 0,
          workflowRowCount: 0,
          migrationRowCount: 0,
        }),
      ),
    ),
    true,
  )
  assert.match(
    leftReason(
      decidePreviewBaseline({
        userTableExists: true,
        workflowsTableExists: true,
        userRowCount: 1,
        workflowRowCount: 0,
        migrationRowCount: 0,
      }),
    ),
    /already has rows/,
  )
})

test("migration hash matches the file bytes Drizzle records", () => {
  const sqlText = readFileSync(
    join(migrationsFolder, "0000_broken_exodus.sql"),
    "utf8",
  )
  assert.equal(
    committedMigrationHash(sqlText),
    createHash("sha256").update(sqlText).digest("hex"),
  )
})
