import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..")
const localUrl = "postgresql://user:secret@127.0.0.1/flowmark"
const hostedUrl = (name) =>
  `postgresql://user:secret@ep-${name}.neon.tech/neondb`

// Copy wrappers into an isolated repository with fake env files. The pnpm stub
// records handoff only; it never launches a driver or opens a database socket.
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), "flowmark-migrate-"))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  for (const dir of ["scripts", "packages/db", "apps/server", "bin"]) {
    mkdirSync(join(root, dir), { recursive: true })
  }
  for (const name of [
    "db-migration-steps.mjs",
    "db-migrate-ci.mjs",
    "db-env-neon.mjs",
    "db-migrate-local.mjs",
    "db-migrate-production.mjs",
    "db-migrate-preview.mjs",
    "db-migrate-staging.mjs",
  ]) {
    copyFileSync(join(repoRoot, "scripts", name), join(root, "scripts", name))
  }
  const capture = join(root, "capture.jsonl")
  writeFileSync(
    join(root, "bin/pnpm"),
    `#!/usr/bin/env node
const fs = require("node:fs");
fs.appendFileSync(process.env.FLOWMARK_TEST_CAPTURE, JSON.stringify({ args: process.argv.slice(2), url: process.env.DATABASE_MIGRATION_URL, runtimeUrl: process.env.DATABASE_URL, wrapper: process.env.FLOWMARK_MIGRATION_WRAPPER, host: process.env.FLOWMARK_MIGRATION_TARGET_HOST, branch: process.env.NEON_BRANCH }) + "\\n");
process.exit(Number(process.env.FLOWMARK_TEST_CHILD_STATUS || 0));
`,
    { mode: 0o755 },
  )
  const env = {
    ...process.env,
    PATH: `${join(root, "bin")}:${process.env.PATH}`,
    FLOWMARK_TEST_CAPTURE: capture,
  }
  for (const key of [
    "DATABASE_URL",
    "DATABASE_MIGRATION_URL",
    "FLOWMARK_DEMO_MODE",
    "NODE_ENV",
    "VERCEL_ENV",
    "NEON_BRANCH",
    "FLOWMARK_MIGRATION_WRAPPER",
    "FLOWMARK_MIGRATION_TARGET_HOST",
    "FLOWMARK_TEST_CHILD_STATUS",
  ]) {
    delete env[key]
  }
  const writeBranch = (name, url = hostedUrl(name), marker = name) => {
    writeFileSync(
      join(
        root,
        `packages/db/.env.neon${name === "production" ? "" : `.${name}`}`,
      ),
      `NEON_BRANCH=${marker}\nDATABASE_URL_UNPOOLED="${url}"\n`,
    )
  }
  for (const name of ["production", "preview", "staging"]) writeBranch(name)
  return {
    root,
    writeBranch,
    clearBranches: () => {
      for (const suffix of ["", ".preview", ".staging"])
        rmSync(join(root, `packages/db/.env.neon${suffix}`))
    },
    run: (name, args = [], overrides = {}) =>
      spawnSync(
        process.execPath,
        [join(root, `scripts/db-migrate-${name}.mjs`), ...args],
        { cwd: root, env: { ...env, ...overrides }, encoding: "utf8" },
      ),
    calls: () =>
      existsSync(capture)
        ? readFileSync(capture, "utf8").trim().split("\n").map(JSON.parse)
        : [],
  }
}

test("actual migrate CLI refuses exported remote URLs before attempting a connection", () => {
  for (const migrationUrl of [
    hostedUrl("fake"),
    "postgresql://user:secret@db.example.invalid/db",
    "secret-invalid-url",
  ]) {
    const result = spawnSync(
      process.execPath,
      ["--import", "tsx", "src/cli/migrate.ts"],
      {
        cwd: join(repoRoot, "packages/db"),
        encoding: "utf8",
        timeout: 10000,
        env: {
          ...process.env,
          DATABASE_URL: localUrl,
          DATABASE_MIGRATION_URL: migrationUrl,
          FLOWMARK_MIGRATION_WRAPPER: "",
          FLOWMARK_MIGRATION_TARGET_HOST: "",
          NEON_BRANCH: "",
        },
      },
    )
    assert.equal(result.status, 1)
    assert.match(result.stderr, /Refusing migrate/)
    assert.doesNotMatch(
      result.stderr + result.stdout,
      /secret|postgresql:\/\/|Database migrate failed/,
    )
  }
})

test("local wrapper pins quoted loopback URL despite a remote URL in the env file", (t) => {
  const f = fixture(t)
  writeFileSync(
    join(f.root, "apps/server/.env.local"),
    `DATABASE_URL="${localUrl}"\nDATABASE_MIGRATION_URL="${hostedUrl("production")}"\nFLOWMARK_DEMO_MODE=true\n`,
  )
  const result = f.run("local")
  assert.equal(result.status, 0, result.stderr)
  assert.equal(f.calls()[0].url, localUrl)
  assert.equal(f.calls()[0].runtimeUrl, localUrl)
  assert.deepEqual(f.calls()[0].args, [
    "--filter",
    "@flowmark/db",
    "db:migrate",
  ])
})

test("local wrapper still refuses exported remote migration URL and propagates child failure", (t) => {
  const f = fixture(t)
  const env = { DATABASE_URL: localUrl, FLOWMARK_DEMO_MODE: "true" }
  assert.equal(
    f.run("local", [], {
      ...env,
      DATABASE_MIGRATION_URL: hostedUrl("production"),
    }).status,
    1,
  )
  assert.equal(f.calls().length, 0)
  assert.equal(
    f.run("local", [], { ...env, FLOWMARK_TEST_CHILD_STATUS: "7" }).status,
    7,
  )
})

for (const [name, flag] of [
  ["production", "production"],
  ["preview", "preview"],
  ["staging", "staging"],
]) {
  test(`${name} wrapper requires confirmation and hands off its checked host`, (t) => {
    const f = fixture(t)
    assert.equal(f.run(name).status, 1)
    assert.equal(f.calls().length, 0)
    const result = f.run(name, [`--confirm-${flag}-migrate`])
    assert.equal(result.status, 0, result.stderr)
    assert.deepEqual(f.calls()[1], {
      args: ["--filter", "@flowmark/db", "db:migrate"],
      url: hostedUrl(name),
      wrapper: name,
      host: `ep-${name}.neon.tech`,
      branch: name,
    })
    assert.doesNotMatch(result.stdout + result.stderr, /secret|postgresql:\/\//)
  })
}

test("staging wrapper refuses production, preview, loopback, and a wrong branch marker", (t) => {
  const f = fixture(t)
  for (const [url, marker] of [
    [hostedUrl("production"), "staging"],
    [hostedUrl("preview"), "staging"],
    [localUrl, "staging"],
    [hostedUrl("staging"), "production"],
  ]) {
    f.writeBranch("staging", url, marker)
    const result = f.run("staging", ["--confirm-staging-migrate"])
    assert.equal(result.status, 1)
    assert.equal(f.calls().length, 0)
    assert.doesNotMatch(result.stderr + result.stdout, /secret|postgresql:\/\//)
  }
})

test("CI wrapper refuses missing approval without reading env files or launching pnpm", (t) => {
  const f = fixture(t)
  const result = f.run("ci")
  assert.equal(result.status, 1)
  assert.equal(f.calls().length, 0)
  assert.doesNotMatch(result.stdout + result.stderr, /postgresql:\/\/|secret@/)
})

test("CI wrapper checks exact revision and distinct pinned hosts before any writes", (t) => {
  const f = fixture(t)
  f.clearBranches()
  writeFileSync(
    join(f.root, "bin/git"),
    `#!/usr/bin/env node\nprocess.stdout.write("${"a".repeat(40)}\\n")\n`,
    { mode: 0o755 },
  )
  const env = {
    GITHUB_ACTIONS: "true",
    FLOWMARK_MIGRATION_APPROVED: "true",
    MIGRATION_TARGET: "staging",
    MIGRATION_SHA: "a".repeat(40),
    MIGRATION_DATABASE_URL:
      "postgresql://user:secret@ep-staging.eu.aws.neon.tech/neondb?sslmode=require",
    MIGRATION_PREVIEW_HOST: "ep-preview.eu.aws.neon.tech",
    MIGRATION_STAGING_HOST: "ep-staging.eu.aws.neon.tech",
    MIGRATION_PRODUCTION_HOST: "ep-production.eu.aws.neon.tech",
  }
  for (const overrides of [
    { MIGRATION_SHA: "b".repeat(40) },
    { MIGRATION_PRODUCTION_HOST: env.MIGRATION_STAGING_HOST },
    {
      MIGRATION_DATABASE_URL:
        "postgresql://user:secret@ep-production.eu.aws.neon.tech/neondb?sslmode=require",
    },
  ]) {
    assert.equal(f.run("ci", [], { ...env, ...overrides }).status, 1)
    assert.equal(f.calls().length, 0)
  }
  const result = f.run("ci", [], env)
  assert.equal(result.status, 0, result.stderr)
  assert.deepEqual(
    f.calls().map((call) => call.args),
    [["db:migrate:staging", "--", "--confirm-staging-migrate"]],
  )
  assert.ok(!existsSync(join(f.root, "packages/db/.env.neon.staging")))
  assert.doesNotMatch(result.stdout + result.stderr, /postgresql:\/\/|secret@/)
})

for (const name of ["production", "preview", "staging"]) {
  test(`${name} migration stops at failed history preflight`, (t) => {
    const f = fixture(t)
    assert.equal(
      f.run(name, [`--confirm-${name}-migrate`], {
        FLOWMARK_TEST_CHILD_STATUS: "9",
      }).status,
      9,
    )
    assert.deepEqual(
      f.calls().map((call) => call.args),
      [["--filter", "@flowmark/db", "db:migrations:verify", "--allow-pending"]],
    )
  })
}

test("CI wrapper cleans temporary operator files after a failed child command", (t) => {
  const f = fixture(t)
  f.clearBranches()
  writeFileSync(
    join(f.root, "bin/git"),
    `#!/usr/bin/env node\nprocess.stdout.write("${"a".repeat(40)}\\n")\n`,
    { mode: 0o755 },
  )
  const result = f.run("ci", [], {
    GITHUB_ACTIONS: "true",
    FLOWMARK_MIGRATION_APPROVED: "true",
    MIGRATION_TARGET: "preview",
    MIGRATION_SHA: "a".repeat(40),
    MIGRATION_DATABASE_URL:
      "postgresql://user:secret@ep-preview.eu.aws.neon.tech/neondb?sslmode=require",
    MIGRATION_PREVIEW_HOST: "ep-preview.eu.aws.neon.tech",
    MIGRATION_STAGING_HOST: "ep-staging.eu.aws.neon.tech",
    MIGRATION_PRODUCTION_HOST: "ep-production.eu.aws.neon.tech",
    FLOWMARK_TEST_CHILD_STATUS: "9",
  })
  assert.equal(result.status, 1)
  assert.equal(f.calls().length, 1)
  for (const suffix of ["", ".preview", ".staging"]) {
    assert.ok(!existsSync(join(f.root, `packages/db/.env.neon${suffix}`)))
  }
  assert.doesNotMatch(result.stdout + result.stderr, /secret@|postgresql:\/\//)
})
