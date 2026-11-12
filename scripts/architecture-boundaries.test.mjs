import assert from "node:assert/strict"
import { readFileSync, readdirSync, existsSync } from "node:fs"
import { dirname, join, posix } from "node:path"
import { URL, fileURLToPath } from "node:url"
import { test } from "node:test"
import {
  reachable,
  runtimeCycles,
  runtimeImports,
  sourceGraph,
} from "./source-graph.mjs"

const root = fileURLToPath(new URL("../", import.meta.url))
const workspaceRoots = ["apps", "packages"].flatMap((kind) =>
  readdirSync(join(root, kind))
    .map((name) => `${kind}/${name}`)
    .filter((dir) => existsSync(join(root, dir, "package.json"))),
)
const workspaces = workspaceRoots.map((dir) => ({
  dir,
  ...JSON.parse(readFileSync(join(root, dir, "package.json"), "utf8")),
}))
const files = workspaceRoots.flatMap((dir) =>
  ["src", "app", "features", "lib"].flatMap((part) => {
    const base = join(root, dir, part)
    return existsSync(base)
      ? readdirSync(base, { recursive: true, encoding: "utf8" })
          .filter(
            (name) => /\.(ts|tsx|mjs)$/.test(name) && !name.endsWith(".d.ts"),
          )
          .map((name) => posix.join(dir, part, name))
      : []
  }),
)
const sources = new Map(
  files.map((file) => [file, readFileSync(join(root, file), "utf8")]),
)
const sourcePath = (path) =>
  [
    path,
    path.replace(/\.(m?js)$/, ".ts"),
    path.replace(/\.(m?js)$/, ".tsx"),
    `${path}.ts`,
    `${path}.tsx`,
    `${path}/index.ts`,
    `${path}/index.tsx`,
  ].find((file) => sources.has(file))
const exportTarget = (value) =>
  typeof value === "string"
    ? value
    : value &&
      (exportTarget(value.import) ??
        exportTarget(value.node) ??
        exportTarget(value.default) ??
        exportTarget(value.types))
const resolveImport = (file, specifier) => {
  if (specifier.startsWith(".")) {
    const path = posix.normalize(posix.join(dirname(file), specifier))
    return sourcePath(path) ?? `unresolved:${file}:${specifier}`
  }
  const workspace = workspaces.find(
    ({ name }) => specifier === name || specifier.startsWith(`${name}/`),
  )
  if (!workspace) {
    return `external:${specifier}`
  }
  const entry =
    specifier === workspace.name
      ? "."
      : `.${specifier.slice(workspace.name.length)}`
  const target = exportTarget(workspace.exports?.[entry])
  return target
    ? (sourcePath(
        posix.join(workspace.dir, target.replace(/^\.\/dist\//, "src/")),
      ) ?? `unresolved:${specifier}`)
    : `unresolved:${specifier}`
}
const graph = sourceGraph(sources, resolveImport)
const checkReachability = (entries, forbidden) =>
  reachable(graph, entries).filter(forbidden)

test("source graph follows runtime barrels, mixed imports, require and dynamic imports", () => {
  assert.deepEqual(
    runtimeImports(
      "fixture.ts",
      `import type { A } from './a'; import { type B } from './b'; export type { C } from './c'; export { type D } from './d'; type E = import('./e').E; import './side'; import { type F, value } from './mixed'; export * from './barrel'; const f = () => import('./lazy'); const x = require('./native')`,
    ),
    ["./side", "./mixed", "./barrel", "./lazy", "./native"],
  )
  const fixture = sourceGraph(
    new Map([
      ["a", `export * from 'b'`],
      ["b", `import('c')`],
      ["c", `import 'a'`],
    ]),
    (_file, specifier) => specifier,
  )
  assert.deepEqual(reachable(fixture, ["a"]), ["a", "b", "c"])
  assert.deepEqual(runtimeCycles(fixture), [["a", "b", "c", "a"]])
  assert.deepEqual(
    reachable(fixture, ["a"]).filter((file) => file === "c"),
    ["c"],
  )
})

test("workspace production runtime graph is acyclic", () => {
  assert.deepEqual(runtimeCycles(graph), [])
})

test("core stays framework-free and DB never depends on auth", () => {
  assert.deepEqual(
    checkReachability(
      files.filter((file) => file.startsWith("packages/core/")),
      (file) =>
        /^(apps\/|packages\/(?!core\/)|external:(node:|next|react|postgres|drizzle))/.test(
          file,
        ),
    ),
    [],
  )
  assert.deepEqual(
    checkReachability(
      files.filter((file) => file.startsWith("packages/db/")),
      (file) => file.startsWith("packages/auth/"),
    ),
    [],
  )
})

test("API use cases stay independent of persistence and frameworks", () => {
  // ApiSettings owns preview validation through DB's pure environment entry and
  // public loopback fixtures; neither acquires a client nor exposes persistence.
  const configurationOnly = new Set([
    "packages/db/src/fixtures/demo.ts",
    "packages/db/src/environment/preview-isolation.ts",
    "packages/db/src/environment/error.ts",
  ])
  const useCases = files.filter(
    (file) => file.startsWith("packages/api/") && file.includes("/use-cases/"),
  )
  assert.deepEqual(
    checkReachability(
      useCases,
      (file) =>
        !configurationOnly.has(file) &&
        /^(apps\/|packages\/(db|auth|mcp)\/|external:(next|@trpc|drizzle|postgres))/.test(
          file,
        ),
    ),
    [],
  )
})

test("browser SDK and portable projections cannot reach server code", () => {
  const entries = [
    "packages/sdk/src/browser/index.ts",
    "packages/evidence-view/src/projection.ts",
    "packages/evidence-view/src/app.tsx",
  ]
  assert.deepEqual(
    checkReachability(entries, (file) =>
      /^(apps\/|packages\/(api|auth|db|mcp|email)\/|external:(node:|next|server-only))/.test(
        file,
      ),
    ),
    [],
  )
  assert.deepEqual(
    checkReachability(entries, (file) => file.startsWith("unresolved:")),
    [],
  )
})

test("MCP host configuration cannot acquire the auth provider", () => {
  assert.deepEqual(
    checkReachability(
      ["apps/server/src/adapters/mcp/mcp-host-configuration.ts"],
      (file) => file === "apps/server/src/auth.ts",
    ),
    [],
  )
})

test("MCP reaches persistence only through API capabilities", () => {
  assert.deepEqual(
    [...sources]
      .filter(([file]) => file.startsWith("packages/mcp/src/"))
      .flatMap(([file, text]) =>
        runtimeImports(file, text)
          .filter((specifier) => specifier.startsWith("@flowmark/db"))
          .map((specifier) => `${file} → ${specifier}`),
      ),
    [],
  )
})
