import assert from "node:assert/strict"
import { test } from "node:test"
import { Effect } from "effect"
import { readRunFactsOptions } from "../../src/cli/run-facts-options.js"
const project = "00000000-0000-4000-8000-000000000002"
test("run-fact options require an explicit project and bounded budgets", () => {
  const defaults = Effect.runSync(readRunFactsOptions(["--project", project]))
  assert.equal(defaults.apply, false)
  assert.equal(defaults.maxRuns, 100)
  for (const args of [
    [],
    ["--project", "bad"],
    ["--project", project, "--batch-size", "101"],
    ["--project", project, "--max-runs", "0"],
    ["--project", project, "--apply"],
    ["--project", project, "--checkpoint", "file", "--after", project],
    ["--project", project, "--unknown"],
  ]) {
    assert.throws(() => Effect.runSync(readRunFactsOptions(args)))
  }
})

test("backfill CLI refuses hosted/production targets and invalid checkpoints before connecting", async () => {
  const { spawnSync } = await import("node:child_process")
  const { mkdtemp, writeFile, rm } = await import("node:fs/promises")
  const { tmpdir } = await import("node:os")
  const { join } = await import("node:path")
  const { fileURLToPath } = await import("node:url")
  const command = fileURLToPath(
    new URL("../../src/cli/backfill-run-facts.ts", import.meta.url),
  )
  const folder = await mkdtemp(join(tmpdir(), "flowmark-facts-test-"))
  const checkpoint = join(folder, "checkpoint.json")
  const invoke = (target: string, extra: string[] = [], production = false) =>
    spawnSync(
      process.execPath,
      ["--import", "tsx", command, "--project", project, ...extra],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          DATABASE_URL: target,
          NODE_ENV: production ? "production" : "test",
          VERCEL_ENV: "",
        },
      },
    )
  try {
    for (const target of [
      "postgresql://user:private@host.invalid/db",
      "invalid-url",
    ]) {
      const result = invoke(target)
      assert.equal(result.status, 1)
      assert.ok(!result.stderr.includes("private"))
    }
    assert.equal(invoke("postgresql://127.0.0.1:1/test", [], true).status, 1)
    await writeFile(checkpoint, "invalid json")
    const invalid = invoke("postgresql://127.0.0.1:1/test", [
      "--checkpoint",
      checkpoint,
    ])
    assert.equal(invalid.status, 1)
    assert.match(invalid.stderr, /checkpoint/)
    await writeFile(
      checkpoint,
      JSON.stringify({
        version: 1,
        target: "other-database",
        project,
        after: null,
      }),
    )
    const mismatch = invoke("postgresql://127.0.0.1:1/test", [
      "--checkpoint",
      checkpoint,
    ])
    assert.equal(mismatch.status, 1)
    assert.match(mismatch.stderr, /another database or project/)
  } finally {
    await rm(folder, { recursive: true, force: true })
  }
})
