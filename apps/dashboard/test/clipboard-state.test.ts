import { expect, it } from "vitest"
import { clipboardCopyFailureDescription } from "../features/shared/clipboard-state"

it("describes manual recovery when clipboard copy fails", () => {
  expect(clipboardCopyFailureDescription).toContain("copy it manually")
  expect(clipboardCopyFailureDescription).toContain("clipboard permissions")
})
