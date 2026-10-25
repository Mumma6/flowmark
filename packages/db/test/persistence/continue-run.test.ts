import assert from "node:assert/strict"
import { test } from "node:test"
import {
  ignoreContinuedEvent,
  runTerminal,
} from "../../src/persistence/workflows/writes/continue-run.js"

test("an open run accepts later markers", () => {
  assert.equal(runTerminal(new Set(["started", "step"])), "open")
  assert.equal(ignoreContinuedEvent("open", "step"), false)
  assert.equal(ignoreContinuedEvent("open", "completed"), false)
})

test("failed wins over completed and ignores later events", () => {
  assert.equal(runTerminal(new Set(["completed", "failed"])), "failed")
  assert.equal(ignoreContinuedEvent("failed", "step"), true)
  assert.equal(ignoreContinuedEvent("failed", "failed"), true)
})

test("completed ignores later markers except fail", () => {
  assert.equal(runTerminal(new Set(["started", "completed"])), "completed")
  assert.equal(ignoreContinuedEvent("completed", "step"), true)
  assert.equal(ignoreContinuedEvent("completed", "completed"), true)
  assert.equal(ignoreContinuedEvent("completed", "failed"), false)
})
