import assert from "node:assert/strict"
import { test } from "node:test"
import { spawnSync } from "node:child_process"
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join, delimiter } from "node:path"
import { fileURLToPath } from "node:url"
import { Array, Effect } from "effect"
import {
  productionInvitationEnvironment,
  readInvitationEnvironment,
} from "../src/cli/invitation-environment.js"

const resource = (
  name: string,
  type: string,
  outputs: Record<string, unknown>,
) => ({
  urn: `urn:pulumi:production::flowmark-infrastructure::${type}::${name}`,
  type,
  outputs,
})
const binding = (key: string, value: string) =>
  resource(
    `api-production-${key.toLowerCase().replaceAll("_", "-")}`,
    "vercel:index/projectEnvironmentVariable:ProjectEnvironmentVariable",
    {
      key,
      targets: ["production"],
      value: { plaintext: JSON.stringify(value) },
    },
  )
const fixture = () => ({
  deployment: {
    resources: [
      resource("neon-production", "neon:index/branch:Branch", {
        id: "br-test-production",
        name: "production",
      }),
      resource("neon-production-compute", "neon:index/endpoint:Endpoint", {
        branchId: "br-test-production",
        hostPooling: "ep-test-pooler.eu.neon.tech",
      }),
      resource("neon-production-owner", "neon:index/role:Role", {
        branchId: "br-test-production",
        name: "owner",
        password: { plaintext: JSON.stringify("synthetic@secret/password") },
      }),
      resource("neon-production-database", "neon:index/database:Database", {
        branchId: "br-test-production",
        name: "neondb",
        ownerName: "owner",
      }),
      resource(
        "api-production-resend-sending-key",
        "resend:index/apiKey:ApiKey",
        {
          permission: "sending_access",
          domainId: "test-domain",
          token: { plaintext: JSON.stringify("re_synthetic_sending_only") },
        },
      ),
      binding("BETTER_AUTH_URL", "https://app.flowmark.dev"),
      binding("FLOWMARK_EMAIL_ENVIRONMENT", "production"),
      binding("FLOWMARK_EMAIL_FROM", "accounts@example.test"),
      binding("FLOWMARK_EMAIL_REPLY_TO", "support@example.test"),
    ],
  },
})

test("reads existing managed Production values and safely encodes database credentials", async () => {
  const env = await Effect.runPromise(
    productionInvitationEnvironment(fixture()),
  )
  const url = new URL(env.DATABASE_URL!)
  assert.equal(decodeURIComponent(url.password), "synthetic@secret/password")
  assert.equal(url.hostname, "ep-test-pooler.eu.neon.tech")
  assert.equal(env.RESEND_API_KEY, "re_synthetic_sending_only")
  assert.equal(env.NEON_BRANCH, "production")
  assert.equal(env.BETTER_AUTH_URL, "https://app.flowmark.dev")
})

test("rejects a mixed branch or an unrestricted sending key", async () => {
  const mixed = fixture()
  mixed.deployment.resources[1].outputs.branchId = "br-staging"
  await assert.rejects(
    Effect.runPromise(productionInvitationEnvironment(mixed)),
    { reason: /identity does not match/ },
  )
  const unrestricted = fixture()
  unrestricted.deployment.resources[4].outputs.permission = "full_access"
  await assert.rejects(
    Effect.runPromise(productionInvitationEnvironment(unrestricted)),
    { reason: /identity does not match/ },
  )
})

test("rejects another stack and Preview-scoped bindings", async () => {
  const wrong = fixture()
  wrong.deployment.resources[0].urn = wrong.deployment.resources[0].urn.replace(
    ":production::",
    ":staging::",
  )
  await assert.rejects(
    Effect.runPromise(productionInvitationEnvironment(wrong)),
    { reason: /Missing managed Production resource/ },
  )
  const preview = fixture()
  preview.deployment.resources[5].outputs.targets = ["preview"]
  await assert.rejects(
    Effect.runPromise(productionInvitationEnvironment(preview)),
    { reason: /not scoped to Production/ },
  )
})

test("complete explicit environments retain their target; partial settings never mix with Production", async () => {
  const env = {
    DATABASE_URL: "postgresql://example.invalid/test",
    NEON_BRANCH: "staging",
    RESEND_API_KEY: "re_test",
    BETTER_AUTH_URL: "https://app.staging.flowmark.dev",
    FLOWMARK_EMAIL_ENVIRONMENT: "staging",
    FLOWMARK_EMAIL_FROM: "sender@example.test",
    FLOWMARK_EMAIL_REPLY_TO: "help@example.test",
  }
  assert.equal(await Effect.runPromise(readInvitationEnvironment(env)), env)
  await assert.rejects(
    Effect.runPromise(
      readInvitationEnvironment({
        DATABASE_URL: "postgresql://private:secret@example.invalid/test",
      }),
    ),
    (error) => {
      assert.match(
        (error as { reason: string }).reason,
        /Missing invitation settings: NEON_BRANCH, RESEND_API_KEY/,
      )
      assert.doesNotMatch(
        (error as { reason: string }).reason,
        /private|postgresql|secret/,
      )
      return true
    },
  )
  await assert.rejects(
    Effect.runPromise(
      readInvitationEnvironment({ DATABASE_MIGRATION_URL: "private-value" }),
    ),
    { reason: /Unset DATABASE_MIGRATION_URL/ },
  )
})

test("the real CLI with an ordinary empty operator environment invokes Pulumi and reports a safe actionable failure", () => {
  const directory = mkdtempSync(join(tmpdir(), "flowmark-invite-cli-"))
  const bin = join(directory, "bin")
  mkdirSync(bin)
  const record = join(directory, "invocation.json")
  writeFileSync(
    join(bin, "pulumi"),
    `#!${process.execPath}\nrequire('node:fs').writeFileSync(${JSON.stringify(record)}, JSON.stringify({ args: process.argv.slice(2), cwd: process.cwd() })); console.error('synthetic-secret-that-must-not-leak'); process.exit(23);\n`,
    { mode: 0o700 },
  )
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    PATH: `${bin}${delimiter}${process.env.PATH}`,
  }
  Array.forEach(
    [
      "DATABASE_URL",
      "DATABASE_MIGRATION_URL",
      "NEON_BRANCH",
      "RESEND_API_KEY",
      "BETTER_AUTH_URL",
      "FLOWMARK_EMAIL_FROM",
      "FLOWMARK_EMAIL_REPLY_TO",
      "FLOWMARK_EMAIL_ENVIRONMENT",
    ],
    (name) => {
      delete env[name]
    },
  )
  try {
    const result = spawnSync(
      process.execPath,
      [
        "--import",
        "tsx",
        "src/cli/invite.ts",
        "person@example.test",
        "--check",
      ],
      {
        cwd: fileURLToPath(new URL("..", import.meta.url)),
        env,
        encoding: "utf8",
        timeout: 30000,
      },
    )
    assert.equal(result.status, 1)
    assert.match(
      result.stderr,
      /Could not read the existing Pulumi Production configuration/,
    )
    assert.doesNotMatch(
      result.stdout + result.stderr,
      /synthetic-secret-that-must-not-leak|Invitation sent/,
    )
    const invocation = JSON.parse(readFileSync(record, "utf8"))
    assert.deepEqual(invocation.args, [
      "stack",
      "export",
      "--stack",
      "production",
      "--show-secrets",
    ])
    assert.ok(invocation.cwd.endsWith("/infrastructure"))
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
