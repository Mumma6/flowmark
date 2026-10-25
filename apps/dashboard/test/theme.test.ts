import { readFileSync, readdirSync } from "node:fs"
import { expect, it } from "vitest"

it("keeps dashboard CSS limited to Tailwind directives and shadcn theme tokens", () => {
  const app = new URL("../app/", import.meta.url)
  expect(
    readdirSync(app, { recursive: true }).filter((path) =>
      path.toString().endsWith(".css"),
    ),
  ).toEqual(["globals.css"])

  const css = readFileSync(new URL("globals.css", app), "utf8")
  for (const layer of ["base", "components", "utilities"]) {
    expect(css).toContain(`@tailwind ${layer};`)
  }
  expect(css).toContain(":root")
  expect(css).toContain(".dark")
  const nonThemeRules = css
    .replace(/@tailwind (?:base|components|utilities);/g, "")
    .replace(/@layer base|:root|\.dark/g, "")
    .replace(/(?:--[\w-]+|color-scheme):[^;]+;/g, "")
    .replace(/[{}\s]/g, "")
  expect(nonThemeRules).toBe("")
})
