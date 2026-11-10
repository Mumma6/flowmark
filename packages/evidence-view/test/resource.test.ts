import { readFileSync } from "node:fs"
import { expect, it } from "vitest"
import { evidenceHtml } from "../dist/resource.js"

it("ships one bounded self-contained resource without server code or ambient authority", () => {
  expect(Buffer.byteLength(evidenceHtml)).toBeLessThanOrEqual(1024 * 1024)
  expect(evidenceHtml).toContain("connect-src 'none'")
  expect(evidenceHtml).toContain("frame-src 'none'")
  expect(evidenceHtml).toContain("form-action 'none'")
  expect(evidenceHtml).not.toMatch(
    /<script[^>]+src=|<link[^>]+href=|\beval\s*\(|new\s+Function\s*\(/i,
  )
  expect(evidenceHtml).not.toContain("WITHHELD_CANARY")
  const meta = JSON.parse(
    readFileSync(
      new URL("../dist/browser-metafile.json", import.meta.url),
      "utf8",
    ),
  )
  expect(
    Object.keys(meta.inputs).some((path) =>
      /packages\/(auth|api|db|mcp)\//.test(path),
    ),
  ).toBe(false)
})
