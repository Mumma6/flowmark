import { expect, it } from "vitest"
import {
  coarsenLastAuthenticated,
  connectionListRecovery,
  connectionProjectLabels,
  interpretOwnedConnection,
  interpretRevokeResult,
} from "../features/connect/connection-revocation"

it("coarsens the last authenticated request to a UTC day", () => {
  expect(coarsenLastAuthenticated(null)).toBe("No authenticated read recorded")
  expect(coarsenLastAuthenticated("2026-11-08T15:42:01.000Z")).toBe(
    "Last authenticated request on 8 Nov 2026 (UTC)",
  )
  expect(coarsenLastAuthenticated("2026-11-08T15:42:01.000Z")).not.toContain(
    "15:42",
  )
})

it("hides a connection the server will not detail for this account", () => {
  expect(
    interpretOwnedConnection({ listed: true, detail: "absent" })._tag,
  ).toBe("UnavailableToAccount")
  expect(
    interpretOwnedConnection({ listed: true, detail: "present" })._tag,
  ).toBe("Owned")
  expect(connectionProjectLabels(["abc"], { abc: "Billing" })).toEqual([
    "Billing",
  ])
})

it("separates a stale Studio session from a temporarily unavailable list", () => {
  expect(connectionListRecovery({ data: { code: "UNAUTHORIZED" } })._tag).toBe(
    "StaleSession",
  )
  expect(connectionListRecovery({ data: { code: "FORBIDDEN" } })._tag).toBe(
    "StaleSession",
  )
  expect(connectionListRecovery(new Error("network"))._tag).toBe("Unavailable")
})

it("acknowledges revoke only after the connection is gone", () => {
  expect(
    interpretRevokeResult({ mutation: "succeeded", stillListed: false })._tag,
  ).toBe("Revoked")
  expect(
    interpretRevokeResult({ mutation: "failed", stillListed: false })._tag,
  ).toBe("Revoked")
  expect(
    interpretRevokeResult({ mutation: "succeeded", stillListed: true })._tag,
  ).toBe("StillActive")
  expect(
    interpretRevokeResult({ mutation: "failed", stillListed: "unknown" })._tag,
  ).toBe("Unknown")
})
