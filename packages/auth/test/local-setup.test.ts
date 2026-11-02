import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

test("actual setup CLI rejects conflicting targets before migration or seed", () => {
  const runtime = "postgresql://local:secret@127.0.0.1:1/flowmark"
  for (const [migration, reason] of [
    ["postgresql://local:secret@127.0.0.1:1/other", /must match DATABASE_URL/],
    [
      "postgresql://local:secret@127.0.0.1:2/flowmark",
      /must match DATABASE_URL/,
    ],
    [
      "postgresql://other:secret@127.0.0.1:1/flowmark",
      /must match DATABASE_URL/,
    ],
    ["postgresql://local:secret@db.example.invalid/flowmark", /loopback/],
    ["secret-invalid-url", /invalid/],
  ] as const) {
    const result = spawnSync(
      process.execPath,
      ["--import", "tsx", "src/cli/setup.ts"],
      {
        cwd: fileURLToPath(new URL("..", import.meta.url)),
        encoding: "utf8",
        // Cold tsx/auth startup competes with other workspace checks on CI.
        timeout: 30000,
        env: {
          ...process.env,
          DATABASE_URL: runtime,
          DATABASE_MIGRATION_URL: migration,
          FLOWMARK_DEMO_MODE: "true",
          FLOWMARK_LOCAL_DATABASE: "native",
          NODE_ENV: "development",
          VERCEL_ENV: "",
        },
      },
    )
    assert.ifError(result.error)
    assert.equal(result.status, 1)
    assert.match(result.stderr, reason)
    assert.doesNotMatch(
      result.stdout + result.stderr,
      /secret|postgresql:\/\/|Database migrate failed|Database seed failed/,
    )
  }
})
