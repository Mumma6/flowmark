#!/usr/bin/env node
import { spawnSync } from "node:child_process"
import console from "node:console"
import process from "node:process"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const dbPackageDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "packages/db",
)
const preview = process.argv.includes("--preview")
const file = preview ? ".env.neon.preview" : ".env.neon"
const branchArgs = preview ? ["--branch", "preview"] : []

console.log(
  preview
    ? "Pulling the Neon preview branch into packages/db/.env.neon.preview (gitignored)."
    : "Pulling Neon connection variables into packages/db/.env.neon (gitignored).",
)
console.log(
  preview
    ? "This does not change apps/server/.env.local, packages/db/.env.neon, or Vercel."
    : "This does not change apps/server/.env.local or Vercel.",
)

const result = spawnSync(
  "npx",
  ["neon@latest", "env", "pull", "--file", file, ...branchArgs],
  {
    cwd: dbPackageDir,
    stdio: "inherit",
  },
)

if (result.status !== 0) {
  process.exit(result.status ?? 1)
}

console.log(
  preview
    ? "Done. Use pnpm db:migrate:preview only after confirming NEON_BRANCH=preview."
    : "Done. Use pnpm db:migrate:prod only after reviewing NEON_BRANCH.",
)
