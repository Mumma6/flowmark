import assert from "node:assert/strict"
import { readFileSync, readdirSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { test } from "node:test"
import ts from "typescript"

const root = fileURLToPath(new URL("../content/docs/", import.meta.url))
const files = readdirSync(root, { recursive: true }).filter((file) =>
  file.endsWith(".mdx"),
)
const documents = new Map(
  files.map((file) => [
    `/docs/${file.replace(/\.mdx$/, "").replace(/\/index$/, "")}`,
    { file, content: readFileSync(path.join(root, file), "utf8") },
  ]),
)
const withoutCode = (content) => content.replace(/```[\s\S]*?```/g, "")
const headingId = (heading) =>
  heading
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, "")
    .replace(/\s/g, "-")

test("every internal link and heading anchor resolves", () => {
  for (const [url, { file, content }] of documents) {
    for (const [, href] of withoutCode(content).matchAll(
      /\[[^\]]+\]\(([^)]+)\)/g,
    )) {
      if (/^https?:/.test(href)) continue
      const target = new URL(href, `https://docs.example${url}`)
      const targetDocument = documents.get(target.pathname)
      assert.ok(targetDocument, `${file}: missing link ${href}`)
      if (target.hash) {
        const headings = [
          ...withoutCode(targetDocument.content).matchAll(/^#{2,6} (.+)$/gm),
        ].map(([, heading]) => headingId(heading))
        assert.ok(
          headings.includes(decodeURIComponent(target.hash.slice(1))),
          `${file}: missing anchor ${href}`,
        )
      }
    }
  }
})

test("each document has frontmatter and a single layout-owned title", () => {
  for (const { file, content } of documents.values()) {
    assert.match(content, /^---\ntitle: .+\ndescription: .+\n---/, file)
    assert.doesNotMatch(withoutCode(content), /^# /m, `${file}: duplicate H1`)
    assert.match(content, /^## /m, `${file}: missing content sections`)
  }
})

test("sidebar metadata orders every page and folder explicitly", () => {
  for (const folder of ["", "concepts", "reference"]) {
    const directory = path.join(root, folder)
    const { pages } = JSON.parse(
      readFileSync(path.join(directory, "meta.json"), "utf8"),
    )
    const entries = pages.filter((entry) => !entry.startsWith("---"))
    const expected = readdirSync(directory, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() || entry.name.endsWith(".mdx"))
      .map((entry) => entry.name.replace(/\.mdx$/, ""))
    assert.deepEqual([...entries].sort(), expected.sort(), folder || "root")
    assert.equal(new Set(entries).size, entries.length, "duplicate navigation")
  }
})

test("SDK client and run methods all have linked API reference pages", () => {
  const sdkTypes = readFileSync(
    new URL("../../../packages/sdk/src/types/index.ts", import.meta.url),
    "utf8",
  )
  const reference = documents.get("/docs/reference").content
  const interfaces = sdkTypes.match(
    /export interface (?:Flow|FlowmarkClient) \{[\s\S]*?\n\}/g,
  )
  assert.equal(interfaces.length, 2)
  for (const declaration of interfaces) {
    for (const [, method] of declaration.matchAll(/^  (\w+)(?:<[^>]+>)?\(/gm)) {
      assert.ok(
        reference.includes(`\`${method}(`),
        `Missing API index link for ${method}`,
      )
    }
  }
})

const blocks = (url) =>
  [...documents.get(url).content.matchAll(/```ts\n([\s\S]*?)```/g)].map(
    ([, code]) => code,
  )

test("representative documented snippets typecheck against the actual SDK", () => {
  const filename = fileURLToPath(
    new URL("../../../packages/sdk/test/docs-contract.ts", import.meta.url),
  )
  const code = `
import { createFlowmark, workflow, MemoryTransport } from "../src/index.js"
import { createFlowmark as createBrowserFlowmark } from "../src/browser/index.js"
import { createFlowmark as createNextFlowmark } from "../src/adapters/next.js"
import { createFlowmarkProxy } from "../src/adapters/proxy.js"
declare const batchId: string
declare const logger: { error(context: unknown, message: string): void }
declare function loadInvoices(id: string): Promise<unknown[]>
declare function saveValidInvoices(invoices: unknown[]): Promise<{imported: number; skipped: number}>
declare function chargeCustomer(): Promise<{receiptId: string}>
declare function reserveStock(): Promise<void>
declare function canRecordWorkflow(request: Request): Promise<boolean>
declare function countProducts(id: string): Promise<number>
declare function fetchProductPages(id: string): AsyncIterable<unknown[]>
declare function updateStock(page: unknown[]): Promise<void>
declare const supplierId: string
const flowmark = createFlowmark()
const run = flowmark.workflow("test.run")
${blocks("/docs/sdk")[1].replace(/^import .+$/gm, "")}
async function operationExamples() {
${blocks("/docs/reference/operation")[1]}
${blocks("/docs/reference/operation")[2]}
}
async function progressExample() {
${blocks("/docs/reference/progress")[1]}
}
function browserExample() {
${blocks("/docs/reference/create-flowmark")[2]
  .replace(/^import .+$/gm, "")
  .replace("createFlowmark(", "createBrowserFlowmark(")}
}
function nextExample() {
${blocks("/docs/reference/create-flowmark")[1]
  .replace(/^import .+$/gm, "")
  .replace("createFlowmark(", "createNextFlowmark(")}
}
function advancedExample() {
${blocks("/docs/reference/advanced")[0].replace(/^import .+$/gm, "")}
}
function proxyExample() {
${blocks("/docs/reference/proxy")[1]
  .replace(/^import .+$/gm, "")
  .replace("export const", "const")}
}
`
  const options = {
    noEmit: true,
    strict: true,
    skipLibCheck: true,
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
  }
  const host = ts.createCompilerHost(options)
  const original = host.getSourceFile.bind(host)
  host.getSourceFile = (
    file,
    languageVersion,
    onError,
    shouldCreateNewSourceFile,
  ) =>
    file === filename
      ? ts.createSourceFile(file, code, languageVersion, true)
      : original(file, languageVersion, onError, shouldCreateNewSourceFile)
  const program = ts.createProgram([filename], options, host)
  const diagnostics = ts.getPreEmitDiagnostics(program)
  assert.equal(
    diagnostics.length,
    0,
    ts.formatDiagnosticsWithColorAndContext(diagnostics, {
      getCanonicalFileName: (file) => file,
      getCurrentDirectory: () => process.cwd(),
      getNewLine: () => "\n",
    }),
  )
})
