import assert from "node:assert/strict"
import { test } from "node:test"
import { disposableIntegrationDatabase } from "../src/agent-access/compose-provider.js"

test("recognizes both disposable integration database sources", () => {
  assert.equal(
    disposableIntegrationDatabase({ FLOWMARK_TEST_DATABASE_SOURCE: "compose" }),
    true,
  )
  assert.equal(
    disposableIntegrationDatabase({
      FLOWMARK_TEST_DATABASE_SOURCE: "ci-service",
    }),
    true,
  )
  assert.equal(disposableIntegrationDatabase({}), false)
  assert.equal(
    disposableIntegrationDatabase({ FLOWMARK_TEST_DATABASE_SOURCE: "hosted" }),
    false,
  )
})
