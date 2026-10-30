import assert from "node:assert/strict"
import { test } from "node:test"
import { Effect, Either } from "effect"
import { verifyMigrationHistory } from "../../src/cli/migration-history.js"
const expected = [
  { hash: "a", folderMillis: 1 },
  { hash: "b", folderMillis: 2 },
]
const first = { hash: "a", created_at: "1" }
const verify = (
  actual: readonly { hash: string; created_at: string }[],
  pending = false,
) =>
  Effect.runSync(
    Effect.either(verifyMigrationHistory(expected, actual, pending)),
  )
test("accepts complete history and an explicitly allowed prefix", () => {
  assert.ok(Either.isRight(verify([first, { hash: "b", created_at: "2" }])))
  assert.ok(Either.isRight(verify([first], true)))
  assert.ok(Either.isRight(verify([], true)))
})
test("refuses pending, modified, reordered and newer histories", () => {
  for (const actual of [
    [],
    [first],
    [{ hash: "edited", created_at: "1" }],
    [{ hash: "b", created_at: "2" }, first],
    [first, { hash: "b", created_at: "2" }, { hash: "c", created_at: "3" }],
  ]) {
    assert.ok(Either.isLeft(verify(actual)))
  }
  assert.ok(Either.isLeft(verify([{ hash: "edited", created_at: "1" }], true)))
})
