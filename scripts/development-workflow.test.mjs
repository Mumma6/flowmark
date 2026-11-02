import assert from "node:assert/strict"
import { existsSync, readFileSync, readdirSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath, URL } from "node:url"
import { test } from "node:test"

const root = fileURLToPath(new URL("../", import.meta.url))
const manifests = ["package.json", "infrastructure/package.json"]
for (const group of ["apps", "packages"]) {
  for (const name of readdirSync(join(root, group))) {
    const path = `${group}/${name}/package.json`
    if (existsSync(join(root, path))) {
      manifests.push(path)
    }
  }
}
const packages = new Map(
  manifests.map((path) => {
    const manifest = JSON.parse(readFileSync(join(root, path), "utf8"))
    return [manifest.name, { path, ...manifest }]
  }),
)

test("workspace script files and literal pnpm handoffs resolve", () => {
  for (const pkg of packages.values()) {
    for (const [name, command] of Object.entries(pkg.scripts ?? {})) {
      const label = `${pkg.path}: ${name}`
      for (const match of command.matchAll(
        /(?:^|\s)([\w./*-]+\.(?:mjs|ts))(?=\s|$)/g,
      )) {
        // Globbed tests are checked by their containing directory; execution
        // discovers actual cases. Literal entrypoints must exist themselves.
        const file = match[1]
        const path = file.includes("*") ? dirname(file) : file
        assert.ok(
          existsSync(join(root, dirname(pkg.path), path)),
          `${label}: missing ${file}`,
        )
      }
      for (const match of command.matchAll(
        /pnpm --filter ([\w@/.-]+) ([\w:-]+)/g,
      )) {
        const target = packages.get(match[1].replace(/\.\.\.$/, ""))
        assert.ok(target?.scripts?.[match[2]], `${label}: broken ${match[0]}`)
      }
    }
  }
})

test("dev commands check ownership/readiness and keep database mutation explicit", () => {
  const scripts = packages.get("flowmark").scripts
  for (const name of ["dev", "dev:all"]) {
    assert.match(scripts[name], /infra doctor --require-ready && turbo dev/)
    assert.doesNotMatch(
      scripts[name],
      /db:setup|db:seed|db:migrate|infra up|studio/,
    )
  }
  assert.match(scripts["dev"], /--filter=@flowmark\/server\.\.\./)
  assert.equal(
    scripts["dev:stack"],
    "pnpm dev:setup && pnpm infra up && turbo dev",
  )
  assert.doesNotMatch(
    scripts["dev:stack"],
    /db:setup|db:seed|db:migrate|studio/,
  )
  assert.equal(
    scripts["db:migrate:local"],
    "pnpm --filter @flowmark/db db:migrate --local",
  )
  const db = packages.get("@flowmark/db")
  assert.ok(
    !Object.values(db.scripts).some((command) =>
      command.includes("--filter @flowmark/auth"),
    ),
  )
})

test("every application dev server binds to the documented loopback host", () => {
  for (const pkg of packages.values()) {
    if (pkg.path.startsWith("apps/")) {
      assert.match(pkg.scripts.dev, /next dev --hostname 127\.0\.0\.1/)
    }
  }
})
