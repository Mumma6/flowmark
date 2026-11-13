import assert from "node:assert/strict"
import { test } from "node:test"
import { Effect, Result } from "effect"
import { assertLocalEvidenceCaptureTarget } from "../../src/environment/evidence-capture-target.js"
test("capture admission denies hosted markers and forged local URLs before probing infrastructure", async () => {
  const base = {
    DATABASE_URL:
      "postgres://flowmark_test:local_test_only@127.0.0.1:5432/flowmark_test",
    TEST_DATABASE_URL:
      "postgres://flowmark_test:local_test_only@127.0.0.1:5432/flowmark_test",
  }
  const results = await Effect.runPromise(
    Effect.forEach(
      [
        { NODE_ENV: "production" },
        { VERCEL: "1" },
        { VERCEL_ENV: "preview" },
        { FLOWMARK_MIGRATION_WRAPPER: "1" },
        { FLOWMARK_MIGRATION_APPROVED: "1" },
        {},
      ],
      (env) =>
        Effect.result(assertLocalEvidenceCaptureTarget({ ...base, ...env })),
    ),
  )
  assert.ok(results.every(Result.isFailure))
})
