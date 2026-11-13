import { expect, it } from "vitest"
import {
  authReturnPath,
  invitationPath,
  invitationReturnPath,
} from "../features/project-sharing/invitation-location"
const id = "11111111-1111-4111-8111-111111111111"
const token = "a".repeat(43)
it("preserves only the exact local invitation proof across sign-in and verification", () => {
  const path = `/invitations/${id}?token=${token}`
  expect(invitationPath(id, token)).toBe(path)
  expect(invitationReturnPath(path)).toBe(path)
  expect(authReturnPath(path)).toBe(path)
})
it.each([
  `https://evil.example/invitations/${id}?token=${token}`,
  `//evil.example/invitations/${id}?token=${token}`,
  `/invitations/${id}?token=${token}&next=https://evil.example`,
  `/invitations/${id}?token=${token}#fragment`,
  `/invitations/${id}?token=short`,
  `/invitations/not-an-id?token=${token}`,
  `/invitations/${id}/../other?token=${token}`,
  `/invitations/${id}?token=${token}%0a`,
  undefined,
  ["/invitations/"],
])("rejects untrusted or ambiguous invitation returns: %s", (value) => {
  expect(invitationReturnPath(value)).toBeUndefined()
})
it("retains the existing agent-consent return route", () => {
  expect(authReturnPath("/connect/agent/consent?request=opaque")).toBe(
    "/connect/agent/consent?request=opaque",
  )
})
