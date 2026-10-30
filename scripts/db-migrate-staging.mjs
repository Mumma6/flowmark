#!/usr/bin/env node
import { runMigrationSteps } from "./db-migration-steps.mjs"
import { spawnSync } from "node:child_process"
import console from "node:console"
import process from "node:process"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import {
  assertStagingMigrationTarget,
  describeDatabaseTarget,
  neonEnvPath,
  previewNeonEnvPath,
  readNeonEnvFileAt,
  stagingNeonEnvPath,
} from "./db-env-neon.mjs"

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..")
const confirmMigrate = process.argv.includes("--confirm-staging-migrate")
const confirmBaseline = process.argv.includes("--confirm-staging-baseline")

if (!confirmMigrate) {
  console.error("Staging migration requires explicit confirmation.")
  console.error("Usage: pnpm db:migrate:staging -- --confirm-staging-migrate")
  console.error(
    "The first apply on a new schema-only branch also passes --confirm-staging-baseline.",
  )
  console.error(
    "This applies committed migrations to Neon branch staging using packages/db/.env.neon.staging only.",
  )
  process.exit(1)
}

let stagingEnv
try {
  stagingEnv = readNeonEnvFileAt(stagingNeonEnvPath)
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  console.error("Pull it with: pnpm neon:env-pull:staging")
  console.error(
    "Do not copy packages/db/.env.neon, packages/db/.env.neon.preview, or apps/server/.env.local.",
  )
  process.exit(1)
}

const migrationUrl = stagingEnv.get("DATABASE_URL_UNPOOLED")
if (!migrationUrl) {
  console.error(
    "DATABASE_URL_UNPOOLED is missing from packages/db/.env.neon.staging.",
  )
  process.exit(1)
}

function readComparedUrl(path, pullCommand) {
  let env
  try {
    env = readNeonEnvFileAt(path)
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    console.error(`Pull it with: ${pullCommand}`)
    process.exit(1)
  }
  const url = env.get("DATABASE_URL_UNPOOLED")
  if (!url) {
    console.error(`DATABASE_URL_UNPOOLED is missing from ${path}.`)
    process.exit(1)
  }
  return url
}

const productionMigrationUrl = readComparedUrl(
  neonEnvPath,
  "pnpm neon:env-pull",
)
const previewMigrationUrl = readComparedUrl(
  previewNeonEnvPath,
  "pnpm neon:env-pull:preview",
)

const refusal = assertStagingMigrationTarget({
  branch: stagingEnv.get("NEON_BRANCH"),
  migrationUrl,
  productionMigrationUrl,
  previewMigrationUrl,
})
if (refusal) {
  console.error(refusal)
  process.exit(1)
}

if (process.env.DATABASE_MIGRATION_URL) {
  console.error("Unset exported DATABASE_MIGRATION_URL before staging migrate.")
  console.error(
    "This command reads the URL only from packages/db/.env.neon.staging.",
  )
  process.exit(1)
}

const stagingHost = describeDatabaseTarget(migrationUrl).host
const productionHost = describeDatabaseTarget(productionMigrationUrl).host
const previewHost = describeDatabaseTarget(previewMigrationUrl).host
console.log(
  `Applying committed migrations to Neon staging (host ${stagingHost}).`,
)
console.log(
  "The production and preview env file hosts were compared and not printed.",
)
console.log("Credentials are not printed. Never run pnpm db:seed against Neon.")

const childEnv = {
  ...process.env,
  DATABASE_MIGRATION_URL: migrationUrl,
  NEON_BRANCH: "staging",
  FLOWMARK_MIGRATION_WRAPPER: "staging",
  FLOWMARK_MIGRATION_TARGET_HOST: stagingHost,
  FLOWMARK_PRODUCTION_DATABASE_HOST: productionHost,
  FLOWMARK_PREVIEW_DATABASE_HOST: previewHost,
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
  const baseline = runPackageScript("db:schema-baseline")
  if ((baseline.status ?? 1) !== 0) {
    process.exit(baseline.status ?? 1)
  }
}

process.exit(runMigrationSteps(repoRoot, childEnv))
