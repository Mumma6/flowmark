#!/usr/bin/env node
import { spawnSync } from "node:child_process"
import console from "node:console"
import process from "node:process"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import {
  describeDatabaseTarget,
  isNeonHost,
  readNeonEnvFile,
  readNeonMigrationUrl,
} from "./db-env-neon.mjs"

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..")

if (!process.argv.includes("--confirm-production-migrate")) {
  console.error("Production migration requires explicit confirmation.")
  console.error("Usage: pnpm db:migrate:prod -- --confirm-production-migrate")
  console.error(
    "This applies committed migrations to Neon using packages/db/.env.neon only.",
  )
  process.exit(1)
}

let migrationUrl
try {
  migrationUrl = readNeonMigrationUrl()
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
}

const target = describeDatabaseTarget(migrationUrl)
if (target.kind === "loopback") {
  console.error(
    "Refusing production migrate: DATABASE_URL_UNPOOLED is loopback.",
  )
  process.exit(1)
}
if (!isNeonHost(target.host)) {
  console.error(
    `Refusing production migrate: expected a Neon host (*.neon.tech), got ${target.host}.`,
  )
  process.exit(1)
}

const neonEnv = readNeonEnvFile()
const branch = neonEnv.get("NEON_BRANCH") ?? neonEnv.get("PGHOST") ?? "unknown"
if (neonEnv.get("NEON_BRANCH") && neonEnv.get("NEON_BRANCH") !== "production") {
  console.error(
    `Refusing production migrate: NEON_BRANCH is "${neonEnv.get("NEON_BRANCH")}", not production.`,
  )
  process.exit(1)
}

if (process.env.DATABASE_MIGRATION_URL) {
  console.error(
    "Unset exported DATABASE_MIGRATION_URL before production migrate.",
  )
  console.error("This command reads the URL only from packages/db/.env.neon.")
  process.exit(1)
}

console.log(
  `Applying committed migrations to Neon (host ${target.host}, branch ${branch}).`,
)
console.log("Credentials are not printed. Never run pnpm db:seed against Neon.")

const childEnv = {
  ...process.env,
  DATABASE_MIGRATION_URL: migrationUrl,
  NEON_BRANCH: "production",
  FLOWMARK_MIGRATION_WRAPPER: "production",
  FLOWMARK_MIGRATION_TARGET_HOST: target.host,
}
delete childEnv.DATABASE_URL
delete childEnv.FLOWMARK_DEMO_MODE

const result = spawnSync("pnpm", ["--filter", "@flowmark/db", "db:migrate"], {
  cwd: repoRoot,
  stdio: "inherit",
  env: childEnv,
})

process.exit(result.status ?? 1)
