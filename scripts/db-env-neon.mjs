import { readFileSync, existsSync } from "node:fs"
import { fileURLToPath, URL } from "node:url"
import { dirname, join } from "node:path"

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..")
export const neonEnvPath = join(repoRoot, "packages/db/.env.neon")
export const previewNeonEnvPath = join(
  repoRoot,
  "packages/db/.env.neon.preview",
)

function parseEnvLine(line) {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith("#")) {
    return null
  }
  const index = trimmed.indexOf("=")
  if (index === -1) {
    return null
  }
  const key = trimmed.slice(0, index)
  let value = trimmed.slice(index + 1).trim()
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1)
  }
  return { key, value }
}

export function readNeonEnvFileAt(path) {
  if (!existsSync(path)) {
    throw new Error(`Missing ${path}.`)
  }
  const entries = new Map()
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const parsed = parseEnvLine(line)
    if (parsed) {
      entries.set(parsed.key, parsed.value)
    }
  }
  return entries
}

export function readNeonEnvFile() {
  if (!existsSync(neonEnvPath)) {
    throw new Error(
      `Missing ${neonEnvPath}. From packages/db run: npx neon@latest env pull --file .env.neon`,
    )
  }
  return readNeonEnvFileAt(neonEnvPath)
}

export function readNeonMigrationUrl() {
  const entries = readNeonEnvFile()
  const url = entries.get("DATABASE_URL_UNPOOLED")
  if (!url) {
    throw new Error(
      "DATABASE_URL_UNPOOLED is missing from packages/db/.env.neon. Run pnpm neon:env-pull.",
    )
  }
  return url
}

export function databaseHost(url) {
  return new URL(url).hostname
}

export function isLoopbackHost(hostname) {
  return (
    hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]"
  )
}

export function isNeonHost(hostname) {
  return hostname.endsWith(".neon.tech")
}

export function describeDatabaseTarget(url) {
  const host = databaseHost(url)
  if (isLoopbackHost(host)) {
    return { host, kind: "loopback" }
  }
  if (isNeonHost(host)) {
    return { host, kind: "neon" }
  }
  return { host, kind: "other" }
}

export function assertPreviewMigrationTarget({
  branch,
  migrationUrl,
  productionMigrationUrl,
}) {
  if (branch !== "preview") {
    return `Refusing preview migrate: NEON_BRANCH is "${branch ?? ""}", not preview.`
  }
  let target
  try {
    target = describeDatabaseTarget(migrationUrl)
  } catch {
    return "Refusing preview migrate: preview DATABASE_URL_UNPOOLED is not a valid URL."
  }
  if (target.kind === "loopback") {
    return "Refusing preview migrate: DATABASE_URL_UNPOOLED is loopback."
  }
  if (target.kind !== "neon") {
    return `Refusing preview migrate: expected a Neon host (*.neon.tech), got ${target.host}.`
  }
  if (!productionMigrationUrl) {
    return "Refusing preview migrate: packages/db/.env.neon is required so the preview host can be compared with production."
  }
  let production
  try {
    production = describeDatabaseTarget(productionMigrationUrl)
  } catch {
    return "Refusing preview migrate: production DATABASE_URL_UNPOOLED is not a valid URL."
  }
  if (target.host === production.host) {
    return `Refusing preview migrate: host ${target.host} matches the production env file.`
  }
  return null
}
