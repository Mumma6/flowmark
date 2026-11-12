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

const waitUntil = Effect.fn("test.waitUntil")((ready: () => boolean) =>
  Effect.whileLoop({
    while: () => !ready(),
    body: () => Effect.sleep("10 millis"),
    step: () => {},
  }).pipe(Effect.timeout("5 seconds")),
)

// Opening a file makes it visible before writeFileSync finishes writing. Publish
// readiness atomically so the test cannot interpret an empty PID as Number("") = 0.
const interruptibleChild = `
const fs = require("node:fs");
const file = process.argv[1];
process.on("SIGTERM", () => {
  fs.writeFileSync(file + ".stopped", String(process.pid));
  process.exit(0);
});
fs.writeFileSync(file + ".ready", String(process.pid));
fs.renameSync(file + ".ready", file);
setInterval(() => {}, 1000);
`

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
      TEST_DATABASE_URL: "postgresql://database.example.invalid/flowmark_test",
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
  const pidFile = join(directory, "pid")
  const controller = new AbortController()
  const running = Effect.runPromise(
    integrationCommand(process.execPath, ["-e", interruptibleChild, pidFile], {
      cwd: directory,
      env: process.env,
      detached: true,
    }),
    { signal: controller.signal },
  )
  const rejected = assert.rejects(running)
  t.after(async () => {
    controller.abort()
    await rejected
    rmSync(directory, { recursive: true, force: true })
  })
  await Effect.runPromise(waitUntil(() => existsSync(pidFile)))
  const pid = readFileSync(pidFile, "utf8")
  assert.match(pid, /^[1-9]\d*$/)
  controller.abort()
  await rejected
  // Linux may retain an exited orphan's zombie PID until init reaps it.
  assert.equal(readFileSync(pidFile + ".stopped", "utf8"), pid)
})

test("interruption also stops descendants after their process-group leader has exited", async (t) => {
  const directory = mkdtempSync(join(tmpdir(), "flowmark-descendants-test-"))
  const pidFile = join(directory, "pid")
  const controller = new AbortController()
  const running = Effect.runPromise(
    integrationCommand(
      process.execPath,
      [
        "-e",
        `const fs = require("node:fs"); process.on("exit", () => { fs.writeFileSync(process.argv[1] + ".leader-ready", String(process.pid)); fs.renameSync(process.argv[1] + ".leader-ready", process.argv[1] + ".leader") }); require("node:child_process").spawn(process.execPath, ["-e", ${JSON.stringify(interruptibleChild)}, process.argv[1]], {stdio:"inherit"}); process.exit(0)`,
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
  t.after(async () => {
    controller.abort()
    await rejected
    rmSync(directory, { recursive: true, force: true })
  })
  await Effect.runPromise(
    waitUntil(() => existsSync(pidFile) && existsSync(pidFile + ".leader")),
  )
  const leader = readFileSync(pidFile + ".leader", "utf8")
  assert.match(leader, /^[1-9]\d*$/)
  // Prove the group leader has actually exited/reaped before interrupting its
  // still-running descendant. A fixed delay cannot establish this under CI load.
  await Effect.runPromise(
    waitUntil(() =>
      Result.try(() => process.kill(Number(leader), 0)).pipe(
        Result.match({
          onSuccess: () => false,
          onFailure: (error) => {
            assert.equal((error as NodeJS.ErrnoException).code, "ESRCH")
            return true
          },
        }),
      ),
    ),
  )
  const pid = readFileSync(pidFile, "utf8")
  assert.match(pid, /^[1-9]\d*$/)
  controller.abort()
  await rejected
  // Linux may retain an exited orphan's zombie PID until init reaps it.
  // Acknowledged termination plus closed inherited pipes proves the owned
  // descendant stopped without depending on the host's reaping schedule.
  assert.equal(readFileSync(pidFile + ".stopped", "utf8"), pid)
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
