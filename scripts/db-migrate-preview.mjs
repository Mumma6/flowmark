#!/usr/bin/env node
import { spawnSync } from "node:child_process"
import console from "node:console"
import { existsSync } from "node:fs"
import process from "node:process"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import {
  assertPreviewMigrationTarget,
  describeDatabaseTarget,
  neonEnvPath,
  previewNeonEnvPath,
  readNeonEnvFileAt,
  stagingNeonEnvPath,
} from "./db-env-neon.mjs"

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..")
const confirmMigrate = process.argv.includes("--confirm-preview-migrate")
const confirmBaseline = process.argv.includes("--confirm-preview-baseline")

if (!confirmMigrate) {
  console.error("Preview migration requires explicit confirmation.")
  console.error("Usage: pnpm db:migrate:preview -- --confirm-preview-migrate")
  console.error(
    "The first apply on a new schema-only branch also passes --confirm-preview-baseline.",
  )
  console.error(
    "This applies committed migrations to Neon branch preview using packages/db/.env.neon.preview only.",
  )
  process.exit(1)
}

let previewEnv
try {
  previewEnv = readNeonEnvFileAt(previewNeonEnvPath)
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  console.error("Pull it with: pnpm neon:env-pull:preview")
  console.error("Do not copy packages/db/.env.neon or apps/server/.env.local.")
  process.exit(1)
}

const migrationUrl = previewEnv.get("DATABASE_URL_UNPOOLED")
if (!migrationUrl) {
  console.error(
    "DATABASE_URL_UNPOOLED is missing from packages/db/.env.neon.preview.",
  )
  process.exit(1)
}

let productionEnv
try {
  productionEnv = readNeonEnvFileAt(neonEnvPath)
} catch {
  console.error(
    `Missing ${neonEnvPath}. From packages/db run: npx neon@latest env pull --file .env.neon`,
  )
  process.exit(1)
}

const productionMigrationUrl = productionEnv.get("DATABASE_URL_UNPOOLED")
if (!productionMigrationUrl) {
  console.error("DATABASE_URL_UNPOOLED is missing from packages/db/.env.neon.")
  process.exit(1)
}

let stagingMigrationUrl
if (existsSync(stagingNeonEnvPath)) {
  let stagingEnv
  try {
    stagingEnv = readNeonEnvFileAt(stagingNeonEnvPath)
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
  stagingMigrationUrl = stagingEnv.get("DATABASE_URL_UNPOOLED")
  if (!stagingMigrationUrl) {
    console.error(
      "DATABASE_URL_UNPOOLED is missing from packages/db/.env.neon.staging.",
    )
    process.exit(1)
  }
}

const refusal = assertPreviewMigrationTarget({
  branch: previewEnv.get("NEON_BRANCH"),
  migrationUrl,
  productionMigrationUrl,
  stagingMigrationUrl,
})
if (refusal) {
  console.error(refusal)
  process.exit(1)
}

if (process.env.DATABASE_MIGRATION_URL) {
  console.error("Unset exported DATABASE_MIGRATION_URL before preview migrate.")
  console.error(
    "This command reads the URL only from packages/db/.env.neon.preview.",
  )
  process.exit(1)
}

const previewHost = describeDatabaseTarget(migrationUrl).host
const productionHost = describeDatabaseTarget(productionMigrationUrl).host
console.log(
  `Applying committed migrations to Neon preview (host ${previewHost}).`,
)
console.log("The production env file host was compared and not printed.")
if (stagingMigrationUrl) {
  console.log("The staging env file host was compared and not printed.")
}
console.log("Credentials are not printed. Never run pnpm db:seed against Neon.")

const childEnv = {
  ...process.env,
  DATABASE_MIGRATION_URL: migrationUrl,
  NEON_BRANCH: "preview",
  FLOWMARK_MIGRATION_WRAPPER: "preview",
  FLOWMARK_MIGRATION_TARGET_HOST: previewHost,
  FLOWMARK_PRODUCTION_DATABASE_HOST: productionHost,
}
if (stagingMigrationUrl) {
  childEnv.FLOWMARK_STAGING_DATABASE_HOST =
    describeDatabaseTarget(stagingMigrationUrl).host
}
delete childEnv.DATABASE_URL
delete childEnv.FLOWMARK_DEMO_MODE

function runPackageScript(script) {
  return spawnSync("pnpm", ["--filter", "@flowmark/db", script], {
    cwd: repoRoot,
    stdio: "inherit",
    env: childEnv,
  })
}

if (confirmBaseline) {
  const baseline = runPackageScript("db:preview-baseline")
  if ((baseline.status ?? 1) !== 0) {
    process.exit(baseline.status ?? 1)
  }
}

const result = runPackageScript("db:migrate")
process.exit(result.status ?? 1)
