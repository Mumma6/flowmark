#!/usr/bin/env node
/**
 * Vercel Ignored Build Step for monorepo apps.
 *
 * Exit 0 — skip this project's deployment (unchanged in Turbo's build graph).
 * Exit 1 — proceed with deployment (this workspace or a dependency changed).
 * Exit 2 — misconfiguration or turbo-ignore failure.
 *
 * Uses `npx turbo-ignore` because Vercel runs this command before
 * `installCommand`, so workspace devDependencies are not installed yet.
 *
 * @see https://vercel.com/docs/project-configuration/git-settings#ignored-build-step
 */

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

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const result = spawnSync(
  process.platform === "win32" ? "npx.cmd" : "npx",
  [
    "-y",
    `turbo-ignore@${TURBO_IGNORE_VERSION}`,
    workspace,
    "--fallback",
    "HEAD^1",
  ],
  {
    cwd: root,
    env: process.env,
    stdio: "inherit",
  },
)

if (result.error) {
  console.error(result.error.message)
  process.exit(2)
}

process.exit(result.status ?? 2)
