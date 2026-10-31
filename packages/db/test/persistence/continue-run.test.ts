import assert from "node:assert/strict"
import { test } from "node:test"
import {
  ignoreContinuedEvent,
  runTerminal,
} from "../../src/persistence/workflows/writes/continue-run.js"

test("an open run accepts later markers", () => {
  assert.equal(runTerminal(new Set(["started", "step"])), "open")
  assert.equal(ignoreContinuedEvent("open"), false)
})

test("historical mixed terminals remain failed and closed", () => {
  assert.equal(runTerminal(new Set(["completed", "failed"])), "failed")
  assert.equal(ignoreContinuedEvent("failed"), true)
})

test("completed ignores all later markers", () => {
  assert.equal(runTerminal(new Set(["started", "completed"])), "completed")
  assert.equal(ignoreContinuedEvent("completed"), true)
})
