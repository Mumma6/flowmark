import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"
import { Effect, Result, Option } from "effect"
import {
  committedMigrationHash,
  decidePreviewBaseline,
} from "../../src/environment/preview-baseline.js"
import {
  assertPreviewAuthOrigins,
  assertPreviewDashboardApi,
  assertPreviewDatabase,
  isProductionDeploymentHost,
  isProductionPublicHost,
  previewApiOrigin,
  previewDashboardOrigin,
  stagingApiOrigin,
  stagingDashboardOrigin,
} from "../../src/environment/preview-isolation.js"

const migrationsFolder = fileURLToPath(
  new URL("../../migrations", import.meta.url),
)
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

test("recognises production public hosts", () => {
  assert.equal(isProductionPublicHost("api.flowmark.dev"), true)
  assert.equal(isProductionPublicHost("app.flowmark.dev"), true)
  assert.equal(isProductionPublicHost("ep-fake.neon.tech"), false)
  assert.equal(
    isProductionDeploymentHost("flowmark-api-mumma6s-projects.vercel.app"),
    true,
  )
  assert.equal(
    isProductionDeploymentHost(
      "flowmark-api-git-test-preview-dev-mumma6s-projects.vercel.app",
    ),
    false,
  )
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
  assert.match(
    leftReason(
      assertPreviewDashboardApi(
        "https://flowmark-api-mumma6s-projects.vercel.app",
        { VERCEL_ENV: "preview" },
      ),
    ),
    /flowmark-api-mumma6s-projects\.vercel\.app/,
  )
  Effect.runSync(
    assertPreviewDashboardApi("https://preview.example", {
      VERCEL_ENV: "preview",
    }),
  )
  assert.equal(
    previewApiOrigin({
      VERCEL_ENV: "preview",
      VERCEL_GIT_COMMIT_REF: "test-preview-dev",
    }),
    "https://flowmark-api-git-test-preview-dev-mumma6s-projects.vercel.app",
  )
  assert.equal(
    previewDashboardOrigin({
      VERCEL_ENV: "preview",
      VERCEL_GIT_COMMIT_REF: "test/vercel-preview",
    }),
    "https://flowmark-dashboard-git-test-vercel-preview-mumma6s-projects.vercel.app",
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

test("staging git branch uses pinned origins and its own database marker", () => {
  const stagingEnv = {
    VERCEL_ENV: "preview",
    VERCEL_GIT_COMMIT_REF: "staging",
    FLOWMARK_DATABASE_BRANCH: "staging",
    BETTER_AUTH_URL: stagingDashboardOrigin,
    FLOWMARK_DASHBOARD_ORIGIN: stagingDashboardOrigin,
  }
  assert.equal(previewApiOrigin(stagingEnv), undefined)
  assert.equal(previewDashboardOrigin(stagingEnv), undefined)
  assert.match(
    leftReason(
      assertPreviewDatabase(
        "postgresql://user:secret@ep-preview.neon.tech/db",
        { ...stagingEnv, FLOWMARK_DATABASE_BRANCH: "preview" },
      ),
    ),
    /must be staging/,
  )
  Effect.runSync(
    assertPreviewDatabase(
      "postgresql://user:secret@ep-staging.neon.tech/db",
      stagingEnv,
    ),
  )
  assert.match(
    leftReason(
      assertPreviewAuthOrigins({
        ...stagingEnv,
        BETTER_AUTH_URL:
          "https://flowmark-dashboard-git-staging-mumma6s-projects.vercel.app",
      }),
    ),
    /app\.staging\.flowmark\.dev/,
  )
  Effect.runSync(assertPreviewAuthOrigins(stagingEnv))
  Effect.runSync(assertPreviewDashboardApi(stagingApiOrigin, stagingEnv))
  assert.match(
    leftReason(
      assertPreviewDashboardApi("https://api.flowmark.dev", stagingEnv),
    ),
    /api\.staging\.flowmark\.dev/,
  )
  assert.match(
    leftReason(
      assertPreviewDashboardApi(stagingApiOrigin, {
        VERCEL_ENV: "preview",
        VERCEL_GIT_COMMIT_REF: "some-pr",
      }),
    ),
    /api\.staging\.flowmark\.dev/,
  )
  assert.match(
    leftReason(
      assertPreviewAuthOrigins({
        VERCEL_ENV: "preview",
        VERCEL_GIT_COMMIT_REF: "some-pr",
        BETTER_AUTH_URL: stagingDashboardOrigin,
        FLOWMARK_DASHBOARD_ORIGIN: stagingDashboardOrigin,
      }),
    ),
    /app\.staging\.flowmark\.dev/,
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
