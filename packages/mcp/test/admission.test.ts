import { afterEach, expect, it, vi } from "vitest"
import { Effect } from "effect"

vi.mock("@flowmark/db/persistence", async (original) => {
  const actual = await original<typeof import("@flowmark/db/persistence")>()
  return {
    ...actual,
    consumeMcpBudget: () =>
      Effect.fail(
        new actual.DatabaseError({
          operation: actual.DatabaseOperation.McpAdmission,
          cause: new Error("synthetic storage failure"),
        }),
      ),
  }
})

import { consumeAdmission } from "../src/runtime/admission.js"

afterEach(() => vi.unstubAllEnvs())
it("fails closed when durable admission storage is unavailable", async () => {
  // The mocked operation never connects; this configures only the lazy driver boundary.
  vi.stubEnv("DATABASE_URL", "postgres://test:test@127.0.0.1:1/test")
  vi.stubEnv("VERCEL_ENV", "")
  const error = await Effect.runPromise(
    consumeAdmission("synthetic-service", 10).pipe(Effect.flip),
  )
  expect(error.reason).toBe("Read admission is unavailable.")
  expect(error.reason).not.toContain("synthetic storage failure")
})
