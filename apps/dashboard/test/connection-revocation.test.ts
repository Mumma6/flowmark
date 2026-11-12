import { Effect } from "effect"
import { expect, it } from "vitest"
import {
  coarsenLastAuthenticated,
  confirmConnectionRevocation,
  connectionListRecovery,
  connectionProjectLabels,
  interpretOwnedConnection,
  interpretRevokeResult,
  revokeAndConfirmConnection,
} from "../features/connect/connections/connection-revocation"

it("coarsens the last authenticated request to a UTC day", () => {
  expect(coarsenLastAuthenticated(null)).toBe(
    "No authenticated request recorded",
  )
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
  expect(interpretRevokeResult({ stillListed: false })._tag).toBe("Revoked")
  expect(interpretRevokeResult({ stillListed: true })._tag).toBe("StillActive")
  expect(interpretRevokeResult({ stillListed: "unknown" })._tag).toBe("Unknown")
})

it("distinguishes pending detail, unavailable detail and stale list data", () => {
  expect(
    interpretOwnedConnection({ listed: true, detail: "pending" })._tag,
  ).toBe("Loading")
  expect(
    interpretOwnedConnection({ listed: true, detail: "unavailable" })._tag,
  ).toBe("Unavailable")
  expect(
    interpretOwnedConnection({ listed: false, detail: "present" })._tag,
  ).toBe("Hidden")
})

it("confirms persisted revocation after a lost response and cancels older reads first", async () => {
  const operations: string[] = []
  const result = await Effect.runPromise(
    revokeAndConfirmConnection({
      target: { clientId: "client", authorizationCodeId: "family" },
      revoke: async () => {
        operations.push("revoke")
        throw new Error("response lost")
      },
      cancelRead: async () => {
        operations.push("cancel old read")
      },
      read: async () => {
        operations.push("read fresh state")
        return []
      },
    }),
  )
  expect(operations).toEqual(["revoke", "cancel old read", "read fresh state"])
  expect(result._tag).toBe("Revoked")
})

it("never confirms a revoke from the mutation alone or from a failed refresh", async () => {
  const target = { clientId: "client", authorizationCodeId: "family" }
  const base = {
    target,
    revoke: async () => undefined,
    cancelRead: async () => undefined,
  }
  expect(
    (
      await Effect.runPromise(
        revokeAndConfirmConnection({ ...base, read: async () => [target] }),
      )
    )._tag,
  ).toBe("StillActive")
  expect(
    (
      await Effect.runPromise(
        revokeAndConfirmConnection({
          ...base,
          read: async () => {
            throw new Error("offline")
          },
        }),
      )
    )._tag,
  ).toBe("Unknown")
})

it("recovers an unknown result using a fresh read without resending revoke", async () => {
  let reads = 0
  const target = { clientId: "client", authorizationCodeId: "family" }
  const result = await Effect.runPromise(
    confirmConnectionRevocation({
      target,
      cancelRead: async () => undefined,
      read: async () => {
        reads++
        return []
      },
    }),
  )
  expect(reads).toBe(1)
  expect(result._tag).toBe("Revoked")
})
