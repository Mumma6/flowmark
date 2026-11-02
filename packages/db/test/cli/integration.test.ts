import assert from "node:assert/strict"
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  existsSync,
  mkdirSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"
import { Effect, Result } from "effect"
import { integrationCommand } from "../../src/cli/integration-command.js"
import {
  cleanupTestProject,
  runDisposableIntegration,
} from "../../src/cli/test-integration.js"
import {
  expectedDatabaseCases,
  expectedServerFiles,
  verifyDatabaseReport,
  verifyServerReport,
} from "../../src/cli/integration-reports.js"
import {
  assertTestDatabaseTarget,
  validateOptionalTestDatabase,
} from "../../src/environment/test-database.js"

const failure = async <A>(
  effect: Effect.Effect<A, { readonly reason: string }>,
) =>
  Result.match(await Effect.runPromise(Effect.result(effect)), {
    onFailure: (error) => error.reason,
    onSuccess: () => assert.fail("expected a refusal"),
  })

test("reports require executed database cases and reject skips, missing cases, or failures", async () => {
  const tap =
    expectedDatabaseCases
      .map((name, index) => `ok ${index + 1} - ${name}`)
      .join("\n") +
    "\n# tests 3\n# pass 3\n# fail 0\n# skipped 0\n# cancelled 0\n# todo 0\n"
  await Effect.runPromise(verifyDatabaseReport(tap))
  for (const invalid of [
    "",
    tap.replace("# skipped 0", "# skipped 1"),
    tap.replace("# fail 0", "# fail 1"),
    tap.replace(expectedDatabaseCases[0], "unrelated unit case"),
  ]) {
    assert.match(
      await failure(verifyDatabaseReport(invalid)),
      /missing required database coverage/,
    )
  }
  const report = {
    numTotalTests: expectedServerFiles.length,
    numPendingTests: 0,
    numFailedTests: 0,
    testResults: expectedServerFiles.map((name) => ({
      name: `/repo/${name}.test.ts`,
      assertionResults: [{ status: "passed" }],
    })),
  }
  await Effect.runPromise(verifyServerReport(report))
  for (const invalid of [
    { ...report, numPendingTests: 1 },
    { ...report, numTotalTests: 0 },
    { ...report, testResults: report.testResults.slice(1) },
    { ...report, numFailedTests: 1 },
    {
      ...report,
      testResults: report.testResults.map((file) => ({
        ...file,
        assertionResults: [{ status: "pending" }],
      })),
    },
  ]) {
    assert.match(
      await failure(verifyServerReport(invalid)),
      /missing required database coverage/,
    )
  }
})

test("test targets refuse hosted/development URLs and forged or missing provenance before access", async () => {
  await Effect.runPromise(validateOptionalTestDatabase({}))
  const url =
    "postgresql://flowmark_ci:local_ci_only@127.0.0.1:5432/flowmark_test"
  const env = {
    TEST_DATABASE_URL: url,
    DATABASE_URL: url,
    DATABASE_MIGRATION_URL: url,
    FLOWMARK_TEST_DATABASE_SOURCE: "ci-service",
    GITHUB_ACTIONS: "true",
    CI: "true",
  }
  await Effect.runPromise(assertTestDatabaseTarget(env))
  assert.match(
    await failure(
      runDisposableIntegration(["--ci-service"], () => {}, {
        ...env,
        PATH: "/missing",
        FLOWMARK_MIGRATION_APPROVED: "true",
      }),
    ),
    /Refusing integration database access/,
  )
  for (const override of [
    {
      TEST_DATABASE_URL:
        "postgresql://flowmark:secret-marker@ep-fake.neon.tech/flowmark_test",
    },
    { DATABASE_URL: "postgresql://localhost/flowmark" },
    { GITHUB_ACTIONS: "false" },
    { TEST_DATABASE_URL: url.replace("flowmark_test", "flowmark") },
    { CI: "false" },
    { TEST_DATABASE_URL: url + "?options=secret-marker" },
    { FLOWMARK_MIGRATION_APPROVED: "true" },
    { FLOWMARK_TEST_DATABASE_SOURCE: "compose" },
    { NODE_ENV: "production" },
  ]) {
    assert.doesNotMatch(
      await failure(assertTestDatabaseTarget({ ...env, ...override })),
      /secret-marker/,
    )
  }
})

test("command failures preserve the original exit code and redact saved output", async (t) => {
  const directory = mkdtempSync(join(tmpdir(), "flowmark-command-test-"))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  const log = join(directory, "output.log")
  const result = await Effect.runPromise(
    Effect.result(
      integrationCommand(
        process.execPath,
        [
          "-e",
          'console.log("postgresql://test:secret-marker@localhost/test"); process.exit(7)',
        ],
        { cwd: directory, env: process.env, log, detached: true },
      ),
    ),
  )
  Result.match(result, {
    onFailure: (error) => assert.equal(error.exitCode, 7),
    onSuccess: () => assert.fail("expected command failure"),
  })
  assert.doesNotMatch(readFileSync(log, "utf8"), /secret-marker/)
})

test("interruption terminates the owned child process before resource cleanup finishes", async (t) => {
  const directory = mkdtempSync(join(tmpdir(), "flowmark-interrupt-test-"))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  const pidFile = join(directory, "pid")
  const controller = new AbortController()
  const running = Effect.runPromise(
    integrationCommand(
      process.execPath,
      [
        "-e",
        'require("node:fs").writeFileSync(process.argv[1], String(process.pid)); setInterval(() => {}, 1000)',
        pidFile,
      ],
      { cwd: directory, env: process.env, detached: true },
    ),
    { signal: controller.signal },
  )
  const rejected = assert.rejects(running)
  for (let attempt = 0; attempt < 100 && !existsSync(pidFile); attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  assert.ok(existsSync(pidFile))
  const pid = Number(readFileSync(pidFile, "utf8"))
  controller.abort()
  await rejected
  assert.throws(() => process.kill(pid, 0), { code: "ESRCH" })
})

test("interruption also stops descendants after their process-group leader has exited", async (t) => {
  const directory = mkdtempSync(join(tmpdir(), "flowmark-descendants-test-"))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  const pidFile = join(directory, "pid")
  const controller = new AbortController()
  const script =
    'require("node:fs").writeFileSync(process.argv[1], String(process.pid)); setInterval(() => {}, 1000)'
  const running = Effect.runPromise(
    integrationCommand(
      process.execPath,
      [
        "-e",
        `require("node:child_process").spawn(process.execPath, ["-e", ${JSON.stringify(script)}, process.argv[1]], {stdio:"inherit"}); setTimeout(() => process.exit(0), 20)`,
        pidFile,
      ],
      {
        cwd: directory,
        env: process.env,
        detached: true,
      },
    ),
    { signal: controller.signal },
  )
  const rejected = assert.rejects(running)
  for (let attempt = 0; attempt < 100 && !existsSync(pidFile); attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  assert.ok(existsSync(pidFile))
  const pid = Number(readFileSync(pidFile, "utf8"))
  await new Promise((resolve) => setTimeout(resolve, 100))
  controller.abort()
  await rejected
  assert.throws(() => process.kill(pid, 0), { code: "ESRCH" })
})

test("cleanup uses full IDs and the test profile, and accepts Docker's missing-network response", async (t) => {
  const root = mkdtempSync(join(tmpdir(), "flowmark-cleanup-test-"))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  mkdirSync(join(root, "bin"))
  const run = "b".repeat(32),
    id = "c".repeat(64),
    project = `flowmark-test-${run}`
  const state = join(root, "present")
  const calls = join(root, "calls")
  writeFileSync(state, "yes")
  const labels = {
    "com.docker.compose.project": project,
    "com.docker.compose.service": "postgres-test",
    "io.flowmark.purpose": "integration-postgres",
    "io.flowmark.test-run": run,
  }
  const metadata = {
    Id: id,
    Config: {
      Image: "postgres:18-alpine",
      Labels: labels,
      Env: [
        "POSTGRES_USER=flowmark_test",
        "POSTGRES_DB=flowmark_test",
        "POSTGRES_PASSWORD=local_test_only",
      ],
    },
    State: { Running: true, Health: { Status: "healthy" } },
    HostConfig: { Tmpfs: { "/var/lib/postgresql": "size=512m" } },
    Mounts: [],
    NetworkSettings: { Ports: {} },
  }
  writeFileSync(
    join(root, "bin/docker"),
    `#!${process.execPath}
const fs = require('node:fs');
const args = process.argv.slice(2), state = ${JSON.stringify(state)};
fs.appendFileSync(${JSON.stringify(calls)}, JSON.stringify(args)+'\\n');
if(args[0]==='ps') process.stdout.write(fs.existsSync(state) ? (args.includes('--no-trunc') ? '${id}' : '${id.slice(0, 12)}') : '');
else if(args[0]==='inspect') process.stdout.write(${JSON.stringify(JSON.stringify(metadata))});
else if(args[0]==='network') { if(!fs.existsSync(state)) { process.stderr.write('Error response from daemon: network ${project}_default not found'); process.exit(1); } process.stdout.write(${JSON.stringify(JSON.stringify(labels))}); }
else if(args[0]==='compose' && args.includes('down')) { if(args.includes('--profile') && args.includes('test')) fs.unlinkSync(state); }
else process.exit(2);
`,
    { mode: 0o755 },
  )
  await Effect.runPromise(
    cleanupTestProject(
      { root, project },
      {
        ...process.env,
        PATH: `${join(root, "bin")}:${process.env.PATH}`,
        FLOWMARK_TEST_RUN_ID: run,
        FLOWMARK_TEST_PROJECT: project,
      },
    ),
  )
  assert.equal(existsSync(state), false)
  const commands = readFileSync(calls, "utf8")
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line) as string[])
  assert.ok(
    commands.some(
      (args) => args.includes("down") && args.includes("--profile"),
    ),
  )
  assert.ok(
    !commands.some(
      (args) =>
        args.includes("-v") ||
        args.includes("--volumes") ||
        args.includes("prune"),
    ),
  )
})
