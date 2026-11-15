import { expect, it } from "vitest"
import { supportDetailsPreview } from "../features/support/support-details"

it("includes only deliberately supplied support fields, ignoring attached private objects", () => {
  const preview = supportDetailsPreview({
    code: "API_UNAVAILABLE",
    context: "A synthetic retry failed.",
    url: "https://example.invalid/reset?token=PRIVATE",
    telemetry: "PRIVATE",
    storage: { key: "PRIVATE" },
  })
  expect(preview).toEqual({
    text: "Application: Flowmark Studio\nError code: API_UNAVAILABLE\nContext: A synthetic retry failed.",
  })
  expect(JSON.stringify(preview)).not.toContain("PRIVATE")
})
it("rejects unbounded context and arbitrary messages as error codes", () => {
  expect(
    supportDetailsPreview({ code: "A private URL?token=secret", context: "" }),
  ).toHaveProperty("error")
  expect(
    supportDetailsPreview({ code: "", context: "x".repeat(1001) }),
  ).toHaveProperty("error")
})
