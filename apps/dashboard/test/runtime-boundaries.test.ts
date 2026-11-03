import { Array as Arr } from "effect"
import { existsSync, readFileSync, readdirSync } from "node:fs"
import { dirname, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import ts from "typescript"
import { expect, it } from "vitest"

const root = fileURLToPath(new URL("../", import.meta.url))
const files = ["app", "features"].flatMap((directory) =>
  readdirSync(resolve(root, directory), { recursive: true })
    .filter((name) => /\.tsx?$/.test(String(name)))
    .map((name) => resolve(root, directory, String(name))),
)
const sources = new Map(
  files.map((path) => [
    path,
    ts.createSourceFile(
      path,
      readFileSync(path, "utf8"),
      ts.ScriptTarget.Latest,
      true,
    ),
  ]),
)

it("keeps every client module's transitive runtime imports free of server-only code", () => {
  const violations: string[] = []
  const visited = new Set<string>()
  const visit = (path: string) => {
    if (visited.has(path)) {
      return
    }
    visited.add(path)
    Arr.forEach(
      Arr.fromIterable(sources.get(path)?.statements ?? []),
      (node) => {
        if (
          !ts.isImportDeclaration(node) ||
          !ts.isStringLiteral(node.moduleSpecifier)
        ) {
          return
        }
        if (node.importClause?.isTypeOnly) {
          return
        }
        const bindings = node.importClause?.namedBindings
        if (
          !node.importClause?.name &&
          bindings &&
          ts.isNamedImports(bindings) &&
          bindings.elements.every((element) => element.isTypeOnly)
        ) {
          return
        }
        const specifier = node.moduleSpecifier.text
        // The existing /demo entry point contains public loopback fixtures only.
        if (
          specifier === "server-only" ||
          specifier === "next/headers" ||
          specifier.startsWith("@flowmark/auth/") ||
          (specifier.startsWith("@flowmark/db") &&
            specifier !== "@flowmark/db/demo")
        ) {
          violations.push(`${relative(root, path)} → ${specifier}`)
        }
        if (!specifier.startsWith(".")) {
          return
        }
        const target = [".ts", ".tsx"]
          .map((ext) => resolve(dirname(path), specifier + ext))
          .find(existsSync)
        if (target) {
          visit(target)
        }
      },
    )
  }
  Arr.forEach(Arr.fromIterable(sources), ([path, source]) => {
    if (/^[\s]*["']use client["']/.test(source.text)) {
      visit(path)
    }
  })
  expect(violations).toEqual([])
})
it("centralizes environment access and keeps direct HTTP out of view components", () => {
  const offenders = files
    .filter(
      (path) =>
        !path.includes("/features/platform/config-") &&
        /\bprocess\.env\b/.test(readFileSync(path, "utf8")),
    )
    .map((path) => relative(root, path))
  expect(offenders).toEqual([])
  expect(
    files
      .filter(
        (path) =>
          path.endsWith(".tsx") && /\bfetch\(/.test(readFileSync(path, "utf8")),
      )
      .map((path) => relative(root, path)),
  ).toEqual([])
})

it("keeps dashboard application code free of imperative loops", () => {
  const loops: string[] = []
  const inspect = (node: ts.Node, path: string): void => {
    if (
      ts.isForStatement(node) ||
      ts.isForOfStatement(node) ||
      ts.isForInStatement(node) ||
      ts.isWhileStatement(node) ||
      ts.isDoStatement(node)
    ) {
      loops.push(relative(root, path))
    }
    ts.forEachChild(node, (child) => inspect(child, path))
  }
  Arr.forEach(Arr.fromIterable(sources.entries()), ([path, source]) =>
    inspect(source, path),
  )
  expect(loops).toEqual([])
})
