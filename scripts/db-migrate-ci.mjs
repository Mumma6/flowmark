#!/usr/bin/env node
import { spawnSync } from "node:child_process"
import { existsSync, writeFileSync, unlinkSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import process from "node:process"
import console from "node:console"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const branches = ["preview", "staging", "production"]
const target = process.env.MIGRATION_TARGET
const paths = branches.map((branch) =>
  join(
    root,
    `packages/db/.env.neon${branch === "production" ? "" : `.${branch}`}`,
  ),
)
const written = []
function refuse() {
  throw new Error(
    "Refusing CI migration: require an approved Actions job, exact commit, direct target URL, three distinct pinned Neon hosts, and a clean checkout.",
  )
}
try {
  if (
    process.env.GITHUB_ACTIONS !== "true" ||
    process.env.FLOWMARK_MIGRATION_APPROVED !== "true" ||
    !branches.includes(target) ||
    !/^[a-f0-9]{40}$/.test(process.env.MIGRATION_SHA ?? "")
  )
    refuse()
  if (
    paths.some(existsSync) ||
    process.env.DATABASE_URL ||
    process.env.DATABASE_MIGRATION_URL
  )
    refuse()
  const sha = spawnSync("git", ["rev-parse", "HEAD"], {
    cwd: root,
    encoding: "utf8",
  })
  if (sha.status !== 0 || sha.stdout.trim() !== process.env.MIGRATION_SHA)
    refuse()
  const hosts = branches.map(
    (branch) => process.env[`MIGRATION_${branch.toUpperCase()}_HOST`],
  )
  if (
    new Set(hosts).size !== 3 ||
    hosts.some(
      (host) =>
        !/^[a-z0-9-]+\.[a-z0-9.-]+\.neon\.tech$/.test(host ?? "") ||
        host.split(".")[0].endsWith("-pooler"),
    )
  )
    refuse()
  const secret = process.env.MIGRATION_DATABASE_URL
  if (!secret || /[\r\n]/.test(secret)) refuse()
  const url = new URL(secret)
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    url.hostname !== hosts[branches.indexOf(target)] ||
    !!url.hash ||
    url.searchParams.get("sslmode") !== "require"
  )
    refuse()
  for (const [index, branch] of branches.entries()) {
    // Other environments contribute host comparisons only, never credentials.
    const value =
      branch === target
        ? secret
        : `postgresql://comparison@${hosts[index]}/neondb?sslmode=require`
    writeFileSync(
      paths[index],
      `NEON_BRANCH=${branch}\nDATABASE_URL_UNPOOLED=${value}\n`,
      { flag: "wx", mode: 0o600 },
    )
    written.push(paths[index])
  }
  const env = {
    ...process.env,
    DATABASE_MIGRATION_URL: secret,
    NEON_BRANCH: target,
    FLOWMARK_MIGRATION_WRAPPER: target,
    FLOWMARK_MIGRATION_TARGET_HOST: url.hostname,
  }
  delete env.MIGRATION_DATABASE_URL
  const run = (args, childEnv = env) => {
    const result = spawnSync("pnpm", args, {
      cwd: root,
      env: childEnv,
      stdio: "inherit",
    })
    if (result.status !== 0) {
      throw new Error("Migration command failed; rollout stopped.")
    }
  }
  const wrapperEnv = { ...env }
  delete wrapperEnv.DATABASE_MIGRATION_URL
  run(
    [
      `db:migrate:${target === "production" ? "prod" : target}`,
      "--",
      `--confirm-${target}-migrate`,
    ],
    wrapperEnv,
  )
} catch (error) {
  // Never print raw URL/driver errors, which can contain credentials.
  console.error(
    error instanceof Error && error.message.startsWith("Migration command")
      ? error.message
      : "Refusing CI migration: invalid approval, revision, target or configuration.",
  )
  process.exitCode = 1
} finally {
  for (const path of written) unlinkSync(path)
}
