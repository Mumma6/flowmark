import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { test } from "node:test"
import { fileURLToPath, URL } from "node:url"

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

test("pull-request verification separates language gates with least privilege", () => {
  const yaml = readWorkflow("pull-request.yml")

  assert.match(yaml, /^on:\s*\n\s*pull_request:/m)
  assert.doesNotMatch(yaml, /pull_request_target/)
  assert.doesNotMatch(yaml, /id-token:\s*write/)
  assert.doesNotMatch(yaml, /\$\{\{\s*secrets\./)
  assert.match(yaml, /permissions:\s*\n\s*contents:\s*read/m)
  assert.match(yaml, /pnpm install --frozen-lockfile/)
  assert.match(yaml, /run: pnpm check:typescript/)
  assert.match(yaml, /run: pnpm rust:check/)
  assert.match(yaml, /run: pnpm engine:verify-build/)
})

test("pnpm check retains all local gates including application unit tests", () => {
  const pkg = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8"))
  assert.match(pkg.scripts.check, /pnpm rust:check/)
  assert.match(pkg.scripts.check, /pnpm check:typescript/)
  assert.match(pkg.scripts.check, /pnpm engine:verify-build/)
  assert.match(pkg.scripts["check:typescript"], /pnpm test/)
})

test("the existing required status rejects failed, cancelled or skipped language jobs", () => {
  const yaml = readWorkflow("pull-request.yml")
  const gate = yaml.slice(
    yaml.indexOf("  check:"),
    yaml.indexOf("  application:"),
  )
  assert.match(gate, /needs: \[application, rust, wasm\]/)
  assert.match(gate, /if: always\(\)/)
  const script = gate.split("run: |\n")[1]
  assert.ok(script)
  const run = (job, status) =>
    spawnSync("sh", [
      "-e",
      "-c",
      script.replace(/\$\{\{ needs\.(\w+)\.result \}\}/g, (_, name) =>
        name === job ? status : "success",
      ),
    ]).status
  assert.equal(run(null, "success"), 0)
  for (const job of ["application", "rust", "wasm"]) {
    for (const status of ["failure", "cancelled", "skipped"]) {
      assert.equal(run(job, status), 1, `${job}: ${status}`)
    }
  }
})

test("repository engines and every workflow use the maintained Node major", () => {
  const major = readFileSync(join(repoRoot, ".node-version"), "utf8").trim()
  assert.match(major, /^\d+$/)
  const pkg = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8"))
  assert.equal(pkg.engines.node, `${major}.x`)
  for (const workflow of [
    "pull-request.yml",
    "deploy-release.yml",
    "publish-sdk.yml",
  ]) {
    const yaml = readWorkflow(workflow)
    assert.match(yaml, /node-version-file: .node-version/)
    assert.doesNotMatch(yaml, /node-version:/)
  }
  const migration = readWorkflow("database-migrate.yml")
  assert.ok(migration.includes(`node-version: "${major}"`))
  assert.doesNotMatch(migration, /node-version-file:/)
})

test("integration uses the disposable Actions service and shared complete-report checks", () => {
  const yaml = readWorkflow("pull-request.yml")
  const integration = yaml.slice(yaml.indexOf("  integration:"))
  assert.match(integration, /image: postgres:18-alpine/)
  assert.match(integration, /POSTGRES_USER: flowmark_ci/)
  assert.match(integration, /POSTGRES_DB: flowmark_test/)
  for (const key of [
    "TEST_DATABASE_URL",
    "DATABASE_URL",
    "DATABASE_MIGRATION_URL",
  ]) {
    assert.ok(
      integration.includes(
        `${key}: postgresql://flowmark_ci:local_ci_only@127.0.0.1:5432/flowmark_test`,
      ),
    )
  }
  assert.match(integration, /FLOWMARK_TEST_DATABASE_SOURCE: ci-service/)
  assert.match(integration, /run: pnpm test:integration --ci-service/)
  assert.doesNotMatch(integration, /secrets\.|db:setup|db:seed|docker compose/)
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

test("hosted migrations require explicit dispatch, protected environment and exact revision", () => {
  const yaml = readWorkflow("database-migrate.yml")
  assert.match(yaml, /workflow_dispatch:/)
  assert.doesNotMatch(
    yaml,
    /^\s+(pull_request|pull_request_target|push|schedule):/m,
  )
  assert.match(yaml, /github.ref == 'refs\/heads\/main'/)
  assert.match(yaml, /required_reviewers/)
  assert.match(yaml, /can_admins_bypass, false/)
  assert.match(yaml, /environment: database-\$\{\{ inputs.target \}\}/)
  assert.match(yaml, /needs: preflight/)
  assert.match(yaml, /cancel-in-progress: false/)
  assert.match(yaml, /ref: \$\{\{ inputs.sha \}\}/)
  assert.match(yaml, /persist-credentials: false/)
  assert.match(
    yaml,
    /git merge-base --is-ancestor "\$REVIEWED_SHA" origin\/staging/,
  )
  assert.doesNotMatch(yaml, /db:seed|db:reset|confirm-.*baseline/)
})

test("merge rollout verifies, migrates and deploys in order with no parallel Git deploy", () => {
  const yaml = readWorkflow("deploy-release.yml")
  assert.match(yaml, /branches: \[staging, main\]/)
  assert.match(yaml, /needs: verify/)
  assert.match(yaml, /uses: .\/.github\/workflows\/pull-request.yml/)
  assert.match(yaml, /group: flowmark-database-migrations/)
  assert.match(yaml, /cancel-in-progress: false/)
  assert.ok(
    yaml.indexOf("run: node scripts/db-migrate-ci.mjs") <
      yaml.indexOf("run: node scripts/release-deployment.mjs\n"),
  )
  assert.match(yaml, /vercel@65\.7\.0/)
  assert.doesNotMatch(yaml, /--token|secrets: inherit|pull_request_target/)
  assert.match(yaml, /ref: \$\{\{ github.sha \}\}/)
  for (const app of ["server", "dashboard", "docs", "web"]) {
    const config = JSON.parse(
      readFileSync(join(repoRoot, "apps", app, "vercel.json"), "utf8"),
    )
    assert.deepEqual(config.git.deploymentEnabled, {
      staging: false,
      main: false,
    })
  }
  assert.match(
    readFileSync(join(repoRoot, ".vercelignore"), "utf8"),
    /^private$/m,
  )
})
