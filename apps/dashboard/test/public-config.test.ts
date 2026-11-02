import { expect, it } from "vitest"
import { publicConfig, resolveDocumentationUrl } from "../lib/config/public"

it("keeps browser API calls relative and documentation defaults explicit", () => {
  expect(publicConfig.trpcPath).toBe("/api/trpc")
  expect(publicConfig.authPath).toBe("/api/auth")
  expect(resolveDocumentationUrl(undefined, true)).toBe(
    "http://localhost:3002/docs/introduction",
  )
  expect(resolveDocumentationUrl(undefined, false)).toBe(
    "https://docs.flowmark.dev/docs/introduction",
  )
  expect(
    resolveDocumentationUrl("https://docs.example/guide?tab=install", false),
  ).toBe("https://docs.example/guide?tab=install")
})
it.each([
  "",
  "invalid",
  "javascript:alert(1)",
  "https://user:secret@docs.example",
])("fails explicitly on invalid documentation configuration", (value) => {
  expect(() => resolveDocumentationUrl(value, false)).toThrow(
    expect.objectContaining({ _tag: "DashboardPublicConfigurationError" }),
  )
})
