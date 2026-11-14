import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import {
  cpSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  rmSync,
  symlinkSync,
} from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import process from "node:process"
import console from "node:console"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const route = path.join(
  root,
  "apps/server/.next/server/app/api/trpc/[trpc]/route.js.nft.json",
)
const trace = JSON.parse(readFileSync(route, "utf8"))
const files = trace.files.map((file) => path.resolve(path.dirname(route), file))
const binding = path.join(root, "packages/engine/wasm/engine.js")
assert.ok(
  files.includes(binding),
  "Production tRPC trace must include the generated ESM binding",
)
const binary = readFileSync(
  path.join(root, "packages/engine/wasm/flowmark_engine_bg.wasm"),
)
assert.ok(
  files.some(
    (file) =>
      file.includes(".next/server/chunks/") &&
      file.endsWith(".js") &&
      readFileSync(file, "utf8").includes(binary.toString("base64")),
  ),
  "The actual production server chunk must contain the compiled WASM bytes",
)
const directory = mkdtempSync(path.join(tmpdir(), "flowmark-engine-artifact-"))
const fixtureSets = [
  { method: "summarize_operations_json", file: "operations", input: "events" },
  { method: "compare_summaries_json", file: "comparisons", input: "input" },
  { method: "has_cycle_json", file: "graphs", input: "input" },
].map(({ method, file, input }) => ({
  method,
  cases: JSON.parse(
    readFileSync(
      path.join(root, `crates/flowmark-engine/tests/fixtures/${file}.json`),
      "utf8",
    ),
  ).map((fixture) => ({
    name: fixture.name,
    input: fixture[input],
    expected: fixture.expected,
  })),
}))
const fixtures = JSON.stringify(fixtureSets)
const verify = `
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {pathToFileURL} from 'node:url'
const entry = pathToFileURL(process.argv[1]).href
if (process.argv[2] === 'missing') {
  await assert.rejects(import(entry), {code: 'ERR_MODULE_NOT_FOUND'})
} else {
  const engine = await import(entry)
  for (const suite of JSON.parse(readFileSync(0, 'utf8'))) {
   for (const fixture of suite.cases) {
    const result = JSON.parse(engine[suite.method](JSON.stringify(fixture.input)))
    assert.equal(result.version, 1)
    assert.equal(result.tag, 'Ok')
    assert.deepEqual(result.value, fixture.expected, fixture.name)
   }
  }
  assert.equal(JSON.parse(engine.percentile_json(JSON.stringify({values:[0,10],p:0.95}))).value, 9.5)
}
`
try {
  for (const source of files) {
    const relative = path.relative(root, source)
    assert.ok(
      !relative.startsWith("..") && !path.isAbsolute(relative),
      "Traced dependencies must belong to this checkout",
    )
    const target = path.join(directory, relative)
    mkdirSync(path.dirname(target), { recursive: true })
    const stat = lstatSync(source)
    if (stat.isSymbolicLink()) {
      symlinkSync(readlinkSync(source), target)
    } else if (stat.isFile()) {
      cpSync(source, target)
    }
  }
  const entry = path.join(directory, path.relative(root, binding))
  // The runtime must use embedded bytes, with no dependency on a loose binary.
  rmSync(path.join(path.dirname(entry), "flowmark_engine_bg.wasm"))
  function run(mode) {
    const result = spawnSync(
      process.execPath,
      ["--input-type=module", "-e", verify, entry, mode],
      {
        cwd: directory,
        input: fixtures,
        encoding: "utf8",
        env: { PATH: process.env.PATH, NODE_ENV: "production" },
      },
    )
    assert.equal(result.status, 0, result.stderr || result.error?.message)
  }
  run("present")
  rmSync(entry)
  run("missing")
  console.info(
    `Verified production WASM bytes and isolated traced bindings on ${process.version}: ${fixtureSets.reduce((count, suite) => count + suite.cases.length, 0)} domain fixtures, percentile, and missing-entry failure.`,
  )
} finally {
  rmSync(directory, { recursive: true, force: true })
}
