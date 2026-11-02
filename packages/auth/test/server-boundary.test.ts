import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const source = (name: string) =>
  readFileSync(new URL(`../src/${name}`, import.meta.url), "utf8")

test("signed proxy identity does not import the database or auth provider", () => {
  const identity = source("client-identity.ts")
  assert.doesNotMatch(identity, /@flowmark\/db|better-auth|drizzle|postgres/)
})

test("package exports keep server modules off the browser fallback", () => {
  const manifest = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf8"),
  ) as {
    private: boolean
    exports: Record<string, { node: string; default: string }>
  }
  assert.equal(manifest.private, true)
  for (const entry of Object.values(manifest.exports)) {
    assert.match(entry.node, /^\.\/dist\//)
    assert.equal(entry.default, "./dist/server-only.js")
  }
})
