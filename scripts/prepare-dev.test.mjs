import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"
import process from "node:process"
import { URL } from "node:url"

const script = new URL("./prepare-dev.mjs", import.meta.url)

test("prepares local development configuration without overwriting files or logging keys", () => {
  const root = mkdtempSync(join(tmpdir(), "flowmark-dev-setup-"))
  try {
    for (const app of ["server", "dashboard", "dev-harness"]) {
      mkdirSync(join(root, "apps", app), { recursive: true })
      writeFileSync(
        join(root, "apps", app, ".env.example"),
        `KEY=${app}-private`,
      )
    }
    const existing = join(root, "apps", "server", ".env.local")
    writeFileSync(existing, "DATABASE_URL=existing")
    const run = () =>
      execFileSync(process.execPath, [script.pathname], {
        cwd: root,
        encoding: "utf8",
      })
    const output = run()
    assert.equal(readFileSync(existing, "utf8"), "DATABASE_URL=existing")
    assert.equal(
      readFileSync(join(root, "apps", "dev-harness", ".env.local"), "utf8"),
      "KEY=dev-harness-private",
    )
    assert(!output.includes("private"))
    assert(!run().includes("Created"))
    writeFileSync(join(root, "apps", "dashboard", ".env"), "EXISTING=keep")
    rmSync(join(root, "apps", "dashboard", ".env.local"))
    assert(run().includes("keeping existing .env"))
    assert(!existsSync(join(root, "apps", "dashboard", ".env.local")))
  } finally {
    rmSync(root, { recursive: true })
  }
})
