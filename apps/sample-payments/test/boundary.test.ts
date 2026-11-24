import assert from "node:assert/strict"
import { readdir, readFile } from "node:fs/promises"
import { join } from "node:path"
import { describe, it } from "node:test"

const root = join(import.meta.dirname, "..")

async function sourceText() {
  const groups = await Promise.all(
    ["src", "test"].map(async (directory) => {
      const names = await readdir(join(root, directory))
      return names
        .filter((name) => name.endsWith(".ts"))
        .map((name) => join(directory, name))
    }),
  )
  const files = ["package.json", ...groups.flat()]
  const contents = await Promise.all(
    files.map(async (file) => readFile(join(root, file), "utf8")),
  )
  return contents.join("\n")
}

describe("sample application boundary", () => {
  it("imports the public SDK and not Flowmark API, database, or Studio", async () => {
    const source = await sourceText()
    assert.match(source, /@flowmarkdev\/node/)
    const forbidden = ["api", "db", "dashboard", "ui"].map(
      (name) => `@flowmark/${name}`,
    )
    forbidden.forEach((specifier) => {
      assert.equal(source.includes(specifier), false)
    })
    assert.equal(source.includes(["apps", "dashboard"].join("/")), false)
    const manifest = JSON.parse(
      await readFile(join(root, "package.json"), "utf8"),
    ) as { dependencies?: Record<string, string> }
    const names = Object.keys(manifest.dependencies ?? {})
    assert.ok(names.includes("@flowmarkdev/node"))
    forbidden.forEach((specifier) => {
      assert.equal(names.includes(specifier), false)
    })
  })
})
