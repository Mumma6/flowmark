import assert from "node:assert/strict"
import { test } from "node:test"
import { Effect, Either } from "effect"
import { LOCAL_DEV_AUTH_SECRET } from "../../src/fixtures/demo.js"
import { readAuthSecret } from "../../src/auth/create-auth.js"

test("uses the configured Better Auth secret", () => {
  assert.equal(
    Effect.runSync(readAuthSecret({ BETTER_AUTH_SECRET: "configured-secret" })),
    "configured-secret",
  )
})

test("falls back to the local demo secret outside production", () => {
  assert.equal(
    Effect.runSync(
      readAuthSecret({
        FLOWMARK_DEMO_MODE: "true",
        NODE_ENV: "development",
      }),
    ),
    LOCAL_DEV_AUTH_SECRET,
  )
})

test("refuses a missing secret outside local demo mode", () => {
  Either.match(Effect.runSync(Effect.either(readAuthSecret({}))), {
    onLeft: (error) => assert.equal(error._tag, "AuthConfigurationError"),
    onRight: () => {
      throw new Error("expected AuthConfigurationError")
    },
  })
})
