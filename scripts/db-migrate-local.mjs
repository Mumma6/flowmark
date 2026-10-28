#!/usr/bin/env node
import { spawnSync } from "node:child_process"
import console from "node:console"
import process from "node:process"
import { existsSync, readFileSync } from "node:fs"
import { fileURLToPath, URL } from "node:url"
import { dirname, join } from "node:path"
import { isLoopbackHost } from "./db-env-neon.mjs"

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..")
const serverEnvLocal = join(repoRoot, "apps/server/.env.local")
const serverEnv = join(repoRoot, "apps/server/.env")

function parseEnvFile(path) {
  const values = new Map()
  if (!existsSync(path)) {
    return values
  }
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) {
      continue
    }
    const index = trimmed.indexOf("=")
    if (index === -1) {
      continue
    }
    values.set(trimmed.slice(0, index), trimmed.slice(index + 1).trim())
  }
  return values
}

function resolveLocalDatabaseUrl() {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL
  }
  const local = parseEnvFile(serverEnvLocal)
  const fallback = parseEnvFile(serverEnv)
  return local.get("DATABASE_URL") ?? fallback.get("DATABASE_URL")
}

function resolveDemoMode() {
  if (process.env.FLOWMARK_DEMO_MODE) {
    return process.env.FLOWMARK_DEMO_MODE
  }
  const local = parseEnvFile(serverEnvLocal)
  const fallback = parseEnvFile(serverEnv)
  return local.get("FLOWMARK_DEMO_MODE") ?? fallback.get("FLOWMARK_DEMO_MODE")
}

const databaseUrl = resolveLocalDatabaseUrl()
if (!databaseUrl) {
  console.error(
    "DATABASE_URL is missing. Set it in apps/server/.env.local (loopback PostgreSQL).",
  )
  process.exit(1)
}

const host = new URL(databaseUrl).hostname
if (!isLoopbackHost(host)) {
  console.error(
    `Refusing local migrate: DATABASE_URL host is ${host}, not loopback.`,
  )
  console.error(
    "For Neon production use: pnpm db:migrate:prod -- --confirm-production-migrate",
  )
  process.exit(1)
}

if (process.env.DATABASE_MIGRATION_URL) {
  const migrationHost = new URL(process.env.DATABASE_MIGRATION_URL).hostname
  if (!isLoopbackHost(migrationHost)) {
    console.error(
      `Refusing local migrate: exported DATABASE_MIGRATION_URL points at ${migrationHost}.`,
    )
    console.error("Unset DATABASE_MIGRATION_URL or use pnpm db:migrate:prod.")
    process.exit(1)
  }
}

if (resolveDemoMode() !== "true") {
  console.error(
    "Refusing local migrate: FLOWMARK_DEMO_MODE must be true in apps/server/.env.local.",
  )
  process.exit(1)
}

if (
  process.env.NODE_ENV === "production" ||
  process.env.VERCEL_ENV === "production"
) {
  console.error("Refusing local migrate in a production environment.")
  process.exit(1)
}

console.log(`Applying committed migrations to local database (${host}).`)

const childEnv = { ...process.env }
delete childEnv.DATABASE_MIGRATION_URL

const result = spawnSync("pnpm", ["--filter", "@flowmark/db", "db:migrate"], {
  cwd: repoRoot,
  stdio: "inherit",
  env: childEnv,
})

process.exit(result.status ?? 1)
