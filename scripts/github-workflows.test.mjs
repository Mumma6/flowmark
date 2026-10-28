import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const repoRoot = join(fileURLToPath(new URL(".", import.meta.url)), "..")
const workflowsDir = join(repoRoot, ".github", "workflows")

const readWorkflow = (name) => readFileSync(join(workflowsDir, name), "utf8")

test("pull-request workflow runs pnpm check on pull_request with least privilege", () => {
  const yaml = readWorkflow("pull-request.yml")

  assert.match(yaml, /^on:\s*\n\s*pull_request:/m)
  assert.doesNotMatch(yaml, /pull_request_target/)
  assert.doesNotMatch(yaml, /id-token:\s*write/)
  assert.doesNotMatch(yaml, /\$\{\{\s*secrets\./)
  assert.match(yaml, /permissions:\s*\n\s*contents:\s*read/m)
  assert.match(yaml, /pnpm install --frozen-lockfile/)
  assert.match(yaml, /pnpm check/)
  assert.match(
    yaml,
    /Must not receive database, Neon, Vercel, or npm credentials/,
  )
})

test("pnpm check script includes unit tests", () => {
  const pkg = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8"))
  assert.match(pkg.scripts.check, /pnpm test/)
})

test("intentional failure probe for CI contract", () => {
  assert.fail("temporary probe")
})

test("publish-sdk workflow still publishes only on dispatch or sdk-v* tags", () => {
  const yaml = readWorkflow("publish-sdk.yml")

  assert.match(yaml, /workflow_dispatch:/)
  assert.match(yaml, /tags:\s*\n\s*-\s*"sdk-v\*"/m)
  assert.doesNotMatch(yaml, /^\s*pull_request:/m)
})
