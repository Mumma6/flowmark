import assert from "node:assert/strict"
import { test } from "node:test"
import { Option, Result } from "effect"
import { decodePageCursor } from "../src/persistence/workflows/page-cursor.js"
import {
  decodeOperationsPageCursor,
  encodeOperationsPageCursor,
} from "../src/persistence/workflows/operations-page-cursor.js"
import {
  decodeRelatedRunsPageCursor,
  encodeRelatedRunsPageCursor,
} from "../src/persistence/workflows/related-runs-page-cursor.js"

test("tuple cursor decoding distinguishes missing values and malformed wire input", () => {
  ;[undefined, ""].forEach((cursor) =>
    Result.match(decodePageCursor(cursor), {
      onFailure: assert.fail,
      onSuccess: (value) => assert.ok(Option.isNone(value)),
    }),
  )
  ;[
    "garbage",
    "2026-11-11T01:02:03.123456Z|",
    "invalid|id",
    "2026-11-11|id|extra",
  ].forEach((cursor) => {
    assert.ok(Result.isFailure(decodePageCursor(cursor)))
    assert.equal(decodeOperationsPageCursor(cursor), null)
    assert.equal(decodeRelatedRunsPageCursor(cursor), null)
  })
})

test("both tuple codecs preserve historical timestamp precision, timezone and identifier bytes", () => {
  const startedAt = "2026-11-11T01:02:03.123456+01:00"
  const id = "legacy identifier"
  const wire = `${startedAt}|${id}`
  assert.equal(encodeOperationsPageCursor({ startedAt, operationId: id }), wire)
  assert.equal(encodeRelatedRunsPageCursor({ startedAt, id }), wire)
  assert.deepEqual(decodeOperationsPageCursor(wire), {
    startedAt,
    operationId: id,
  })
  assert.deepEqual(decodeRelatedRunsPageCursor(wire), { startedAt, id })
})
