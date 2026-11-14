import assert from "node:assert/strict"
import { test } from "node:test"
import { Array } from "effect"
import { createFlowmarkAuth } from "../src/create-auth.js"

Array.forEach(
  ["production", "preview", "development", undefined],
  (environment) => {
    test(`registration policy for VERCEL_ENV=${environment ?? "unset"}`, async () => {
      const previous = process.env.VERCEL_ENV
      const previousNode = process.env.NODE_ENV
      try {
        if (environment === undefined) {
          delete process.env.VERCEL_ENV
        } else {
          process.env.VERCEL_ENV = environment
        }
        // Staging/Preview also use a production Node build.
        process.env.NODE_ENV = "production"
        const auth = createFlowmarkAuth({
          db: {} as Parameters<typeof createFlowmarkAuth>[0]["db"],
          secret: "synthetic-test-secret-at-least-thirty-two-characters",
          baseURL: "https://app.example.test",
          trustedOrigins: ["https://app.example.test"],
        })
        const { options } = await auth.$context
        assert.equal(
          options.emailAndPassword?.disableSignUp,
          environment === "production",
        )
        assert.equal(options.emailAndPassword?.enabled, true)
        assert.equal(options.emailAndPassword?.requireEmailVerification, false)
        assert.equal(
          options.emailAndPassword?.revokeSessionsOnPasswordReset,
          true,
        )
      } finally {
        if (previous === undefined) {
          delete process.env.VERCEL_ENV
        } else {
          process.env.VERCEL_ENV = previous
        }
        if (previousNode === undefined) {
          delete process.env.NODE_ENV
        } else {
          process.env.NODE_ENV = previousNode
        }
      }
    })
  },
)
