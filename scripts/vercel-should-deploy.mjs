#!/usr/bin/env node
/**
 * Vercel Ignored Build Step for monorepo apps.
 *
 * Vercel skips the deployment on exit 0 and continues on exit 1 or greater.
 * turbo-ignore exits 0 when unchanged and 1 when the build graph changed.
 * Any other turbo-ignore status (errors) must not exit 2+ or Vercel will still
 * deploy and burn the daily quota.
 *
 * Uses `npx turbo-ignore` because Vercel runs this command before
 * `installCommand`, so workspace devDependencies are not installed yet.
 *
 * @see https://vercel.com/docs/project-configuration/git-settings#ignored-build-step
 */

import process from "node:process"
import console from "node:console"
import { spawnSync } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"

const TURBO_IGNORE_VERSION = "2.11.10"

const workspace = process.argv[2]
if (!workspace) {
  console.error(
    "Usage: node scripts/vercel-should-deploy.mjs <pnpm-workspace-name>",
  )
  process.exit(2)
}

// The controlled pipeline deliberately builds a consistent four-project revision.
// It already passed checks and migration; CLI deployments must not be cancelled
// by the Git integration's affected-project optimization.
if (process.env.FLOWMARK_CONTROLLED_DEPLOY === "true") {
  process.exit(1)
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

function gitVerifyRef(ref) {
  const result = spawnSync("git", ["rev-parse", "--verify", ref], {
    cwd: root,
    encoding: "utf8",
  })
  return result.status === 0 ? ref : null
}

function resolveFallbackRef() {
  if (process.env.VERCEL_GIT_PREVIOUS_SHA) {
    return null
  }

  const branch = process.env.VERCEL_GIT_COMMIT_REF
  if (branch && branch !== "main" && branch !== "staging") {
    return gitVerifyRef("origin/staging") ?? gitVerifyRef("origin/main")
  }
  if (branch === "staging") {
    return gitVerifyRef("origin/main")
  }
  return gitVerifyRef("HEAD~1") ?? gitVerifyRef("HEAD^1")
}

const fallback = resolveFallbackRef()
const args = ["-y", `turbo-ignore@${TURBO_IGNORE_VERSION}`, workspace]
if (fallback) {
  args.push("--fallback", fallback)
}

console.error(
  `[flowmark] vercel-should-deploy ${workspace}` +
    (fallback ? ` fallback=${fallback}` : " (Vercel previous SHA)"),
)

const result = spawnSync(
  process.platform === "win32" ? "npx.cmd" : "npx",
  args,
  {
    cwd: root,
    env: process.env,
    stdio: "inherit",
  },
)

if (result.error) {
  console.error(`[flowmark] turbo-ignore failed: ${result.error.message}`)
  process.exit(0)
}

const status = result.status
if (status === 1) {
  process.exit(1)
}

if (status !== 0) {
  console.error(
    `[flowmark] turbo-ignore exited ${status ?? "unknown"}; skipping deploy to avoid quota burn`,
  )
}

process.exit(0)
