import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const script = path.join(root, "scripts/vercel-should-deploy.mjs")

test("vercel should-deploy requires a workspace name", () => {
  const result = spawnSync(process.execPath, [script], { cwd: root })
  assert.equal(result.status, 2)
})

test("controlled pipeline bypasses Git-only affected-build cancellation", () => {
  const result = spawnSync(process.execPath, [script, "@flowmark/server"], {
    cwd: root,
    env: { ...process.env, FLOWMARK_CONTROLLED_DEPLOY: "true" },
  })
  assert.equal(result.status, 1)
})
