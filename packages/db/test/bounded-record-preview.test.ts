import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { boundJsonPreview } from "../src/persistence/workflows/bounded-record-preview.js"

describe("boundJsonPreview", () => {
  it("returns small values unchanged", () => {
    const preview = boundJsonPreview({ ok: true })
    assert.equal(preview.truncated, false)
    assert.deepEqual(preview.value, { ok: true })
  })

  it("marks oversized payloads with explicit omissions", () => {
    const preview = boundJsonPreview({ payload: "x".repeat(16_000) }, 256)
    assert.equal(preview.truncated, true)
    assert.ok(preview.omissions.length > 0)
    assert.equal((preview.value as { kind: string }).kind, "bounded_preview")
  })
})
