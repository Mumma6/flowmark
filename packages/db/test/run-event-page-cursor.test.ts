import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  decodeRunEventPageCursor,
  encodeRunEventPageCursor,
} from "../src/persistence/workflows/run-event-page-cursor.js"

describe("run event page cursor", () => {
  it("round-trips stable ordering keys", () => {
    const encoded = encodeRunEventPageCursor({
      occurredAt: "2026-01-02T10:00:00.123456Z",
      receivedAt: "2026-01-02T10:00:01.000001Z",
      eventId: "11111111-1111-4111-8111-111111111111",
    })
    assert.deepEqual(decodeRunEventPageCursor(encoded), {
      occurredAt: "2026-01-02T10:00:00.123456Z",
      receivedAt: "2026-01-02T10:00:01.000001Z",
      eventId: "11111111-1111-4111-8111-111111111111",
    })
  })

  it("rejects malformed cursors", () => {
    assert.equal(decodeRunEventPageCursor("bad"), null)
    assert.equal(decodeRunEventPageCursor("a|b"), null)
    assert.equal(
      decodeRunEventPageCursor(
        "2026-01-02T10:00:00Z|2026-01-02T10:00:00Z|not-a-uuid",
      ),
      null,
    )
  })
})
