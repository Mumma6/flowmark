import assert from "node:assert/strict"
import { test } from "node:test"
import { effectFindings, inspect, regressions } from "./factory/guardian.mjs"

const useCase = "packages/api/src/features/runs/use-cases/read-run.ts"
const tree = (files) => new Map(Object.entries(files))

test("Effect AST checks ignore comments, strings and unrelated APIs but follow aliases", () => {
  assert.deepEqual(
    effectFindings(
      useCase,
      `// Effect.catchAll()
    const prose = 'Effect.runPromise()'; const Other = { catchAll() {} }; Other.catchAll()`,
    ),
    [],
  )
  const findings = effectFindings(
    useCase,
    `import { Effect as E, Context as C } from 'effect'
    E.runPromise(E.succeed(1)); E.catchAll(() => 0); C.Tag('x')`,
  )
  assert.deepEqual(
    findings.map((finding) => finding.rule),
    ["effect-execution", "effect-v4", "effect-v4"],
  )
  assert.equal(
    effectFindings(useCase, `import * as E from 'effect/Effect'; E.runSync(x)`)
      .length,
    1,
  )
  assert.equal(
    effectFindings(
      useCase,
      `import * as Fx from 'effect'; Fx.Effect.runSync(x)`,
    ).length,
    1,
  )
  assert.deepEqual(
    effectFindings(
      "packages/sdk/src/client/runtime.ts",
      `import { Effect } from 'effect'; Effect.runPromise(x)`,
    ),
    [],
  )
})

test("internal functional workflows reject loops and async; runtime and framework edges stay exempt", () => {
  const text = `export const read = async () => { for (const x of []) {} }`
  assert.deepEqual(
    effectFindings(useCase, text).map((finding) => finding.rule),
    ["effect-workflow", "functional-iteration"],
  )
  assert.deepEqual(effectFindings("apps/server/app/api/route.ts", text), [])
  assert.deepEqual(
    effectFindings("packages/sdk/src/client/runtime.ts", text),
    [],
  )
})

test("regression comparison tolerates old debt and line shifts but rejects increased occurrences", () => {
  const previous = effectFindings(useCase, `export const read = async () => 1`)
  assert.deepEqual(
    regressions(
      previous,
      effectFindings(useCase, `\n\nexport const read = async () => 2`),
    ),
    [],
  )
  assert.equal(
    regressions(
      previous,
      effectFindings(
        useCase,
        `export const read = async () => 1; export const write = async () => 2`,
      ),
    ).length,
    1,
  )
})

test("docs are optional on code changes; new broken links and deleted backlink targets fail", () => {
  const before = tree({
    "README.md": "[guide](docs/guide.md)",
    "docs/guide.md": "guide",
  })
  assert.deepEqual(
    inspect(before, new Map([...before, [useCase, "export const x = 1"]])),
    [],
  )
  assert.equal(
    inspect(before, tree({ "README.md": "[guide](docs/guide.md)" }))[0].rule,
    "documentation-link",
  )
  assert.equal(
    inspect(
      before,
      new Map([...before, ["docs/new.md", "[missing](absent.md)"]]),
    )[0].rule,
    "documentation-link",
  )
  assert.deepEqual(
    inspect(
      tree({ "README.md": "[old](missing.md)" }),
      tree({ "README.md": "\n[old](missing.md)" }),
    ),
    [],
  )
})

test("documentation links resolve assets, encoded paths and directories without checking web or site routes", () => {
  const after = tree({
    "docs/README.md":
      "[a](../asset%20file.svg) [d](../docs) [s](/sdk) [w](https://example.com) [h](#anchor) `fake [link](bad)`",
    "asset file.svg": "asset",
  })
  assert.deepEqual(inspect(new Map(), after), [])
})

test("removed commands require real matching root command references, not longer command names", () => {
  const before = tree({
    "package.json": JSON.stringify({
      scripts: { test: "test", build: "build" },
    }),
  })
  const after = tree({
    "package.json": JSON.stringify({ scripts: { "test:unit": "test" } }),
    "docs/guide.md": "Run `pnpm test:unit` then `pnpm build`.",
  })
  const findings = inspect(before, after)
  assert.equal(findings.length, 1)
  assert.match(findings[0].message, /pnpm build/)
})

test("type-only manifest dependencies obey ownership and package source organization", () => {
  const after = tree({
    "packages/core/package.json": JSON.stringify({
      name: "@flowmarkdev/core",
      devDependencies: { "@flowmark/api": "workspace:*" },
    }),
    "packages/api/package.json": JSON.stringify({ name: "@flowmark/api" }),
    "packages/sdk/src/Helper.ts": "export const helper = 1",
  })
  assert.deepEqual(
    inspect(new Map(), after).map((finding) => finding.rule),
    ["package-ownership", "source-organization"],
  )
})

test("documentation annotations retain source lines after fenced examples", () => {
  const findings = inspect(
    new Map(),
    tree({
      "docs/guide.md":
        "# Guide\n```md\n[example](missing.md)\n```\n\n[broken](absent.md)",
    }),
  )
  assert.equal(findings.length, 1)
  assert.equal(findings[0].line, 6)
})
