import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const repoRoot = join(fileURLToPath(new URL(".", import.meta.url)), "..")
const workflowsDir = join(repoRoot, ".github", "workflows")
const scriptsDir = join(repoRoot, "scripts")

const readWorkflow = (name) => readFileSync(join(workflowsDir, name), "utf8")

const requiredCheckJobName = () => {
  const yaml = readWorkflow("pull-request.yml")
  const match = yaml.match(/^\s*check:\s*\n\s*name:\s*(.+)$/m)
  assert.ok(
    match,
    "pull-request check job name is required for branch rulesets",
  )
  return match[1].trim()
}

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

test("publish-sdk workflow still publishes only on dispatch or sdk-v* tags", () => {
  const yaml = readWorkflow("publish-sdk.yml")

  assert.match(yaml, /workflow_dispatch:/)
  assert.match(yaml, /tags:\s*\n\s*-\s*"sdk-v\*"/m)
  assert.doesNotMatch(yaml, /^\s*pull_request:/m)
})

test("main ruleset requires the pull-request job check name", () => {
  const jobName = requiredCheckJobName()
  const ruleset = JSON.parse(
    readFileSync(join(scriptsDir, "github-main-ruleset.json"), "utf8"),
  )

  assert.equal(ruleset.enforcement, "active")
  assert.deepEqual(ruleset.conditions.ref_name.include, ["refs/heads/main"])
  assert.equal(ruleset.bypass_actors.length, 1)
  assert.equal(ruleset.bypass_actors[0].actor_type, "User")
  assert.equal(ruleset.bypass_actors[0].bypass_mode, "always")

  const statusRule = ruleset.rules.find(
    (rule) => rule.type === "required_status_checks",
  )
  assert.ok(statusRule)
  assert.equal(statusRule.parameters.required_status_checks[0].context, jobName)

  const pullRequestRule = ruleset.rules.find(
    (rule) => rule.type === "pull_request",
  )
  assert.ok(pullRequestRule)
  assert.equal(pullRequestRule.parameters.required_approving_review_count, 0)

  const updateRule = ruleset.rules.find((rule) => rule.type === "update")
  assert.ok(
    updateRule,
    "update rule restricts merge/push on main to bypass only",
  )
})
