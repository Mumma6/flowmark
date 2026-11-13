import assert from "node:assert/strict"
import test from "node:test"
import { sessionDeviceLabel } from "../src/sessions/session-summary.js"

test("session summaries expose only approximate device labels, never raw user agent data", () => {
  assert.equal(
    sessionDeviceLabel(
      "Mozilla/5.0 (Windows NT 10.0) Chrome/130.0 Safari/537.36 Edg/130.0",
    ),
    "Edge on Windows",
  )
  assert.equal(
    sessionDeviceLabel("Mozilla/5.0 (iPhone; CPU iPhone OS) Safari/604.1"),
    "Safari on iOS",
  )
  assert.equal(
    sessionDeviceLabel("Mozilla/5.0 (Android) Chrome/130.0"),
    "Chrome on Android",
  )
  assert.equal(
    sessionDeviceLabel("<script>synthetic-private-value</script>"),
    "Browser",
  )
  assert.equal(sessionDeviceLabel(undefined), "Browser")
  assert.equal(sessionDeviceLabel(null), "Browser")
})
