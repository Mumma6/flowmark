import { readFileSync, existsSync } from "node:fs"
import { fileURLToPath, URL } from "node:url"
import { dirname, join } from "node:path"

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..")
export const neonEnvPath = join(repoRoot, "packages/db/.env.neon")
export const previewNeonEnvPath = join(
  repoRoot,
  "packages/db/.env.neon.preview",
)
export const stagingNeonEnvPath = join(
  repoRoot,
  "packages/db/.env.neon.staging",
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

function hostedMigrationTarget(migrationUrl, label) {
  let target
  try {
    target = describeDatabaseTarget(migrationUrl)
  } catch {
    return {
      refusal: `Refusing ${label} migrate: ${label} DATABASE_URL_UNPOOLED is not a valid URL.`,
    }
  }
  if (target.kind === "loopback") {
    return {
      refusal: `Refusing ${label} migrate: DATABASE_URL_UNPOOLED is loopback.`,
    }
  }
  if (target.kind !== "neon") {
    return {
      refusal: `Refusing ${label} migrate: expected a Neon host (*.neon.tech), got ${target.host}.`,
    }
  }
  return { target }
}

function comparedHost(migrationUrl, label, otherName) {
  if (!migrationUrl) {
    return {
      refusal: `Refusing ${label} migrate: packages/db/.env.neon${otherName === "production" ? "" : `.${otherName}`} is required so the ${label} host can be compared with ${otherName}.`,
    }
  }
  try {
    return { host: describeDatabaseTarget(migrationUrl).host }
  } catch {
    return {
      refusal: `Refusing ${label} migrate: ${otherName} DATABASE_URL_UNPOOLED is not a valid URL.`,
    }
  }
}

export function assertPreviewMigrationTarget({
  branch,
  migrationUrl,
  productionMigrationUrl,
  stagingMigrationUrl,
}) {
  if (branch !== "preview") {
    return `Refusing preview migrate: NEON_BRANCH is "${branch ?? ""}", not preview.`
  }
  const hosted = hostedMigrationTarget(migrationUrl, "preview")
  if (hosted.refusal) {
    return hosted.refusal
  }
  const production = comparedHost(
    productionMigrationUrl,
    "preview",
    "production",
  )
  if (production.refusal) {
    return production.refusal
  }
  if (hosted.target.host === production.host) {
    return `Refusing preview migrate: host ${hosted.target.host} matches the production env file.`
  }
  if (stagingMigrationUrl) {
    const staging = comparedHost(stagingMigrationUrl, "preview", "staging")
    if (staging.refusal) {
      return staging.refusal
    }
    if (hosted.target.host === staging.host) {
      return `Refusing preview migrate: host ${hosted.target.host} matches the staging env file.`
    }
  }
  return null
}

export function assertStagingMigrationTarget({
  branch,
  migrationUrl,
  productionMigrationUrl,
  previewMigrationUrl,
}) {
  if (branch !== "staging") {
    return `Refusing staging migrate: NEON_BRANCH is "${branch ?? ""}", not staging.`
  }
  const hosted = hostedMigrationTarget(migrationUrl, "staging")
  if (hosted.refusal) {
    return hosted.refusal
  }
  for (const [otherName, otherUrl] of [
    ["production", productionMigrationUrl],
    ["preview", previewMigrationUrl],
  ]) {
    const other = comparedHost(otherUrl, "staging", otherName)
    if (other.refusal) {
      return other.refusal
    }
    if (hosted.target.host === other.host) {
      return `Refusing staging migrate: host ${hosted.target.host} matches the ${otherName} env file.`
    }
  }
  return null
}
