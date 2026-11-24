import { Effect } from "effect"
import { expect, it } from "vitest"
import {
  coarsenLastAuthenticated,
  confirmConnectionRevocation,
  ConnectionList,
  connectionListRecovery,
  connectionProjectLabels,
  interpretOwnedConnection,
  interpretRevokeResult,
  OwnedConnection,
  revokeAndConfirmConnection,
  RevokeFeedbackState,
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
    OwnedConnection.$is("UnavailableToAccount")(
      interpretOwnedConnection({ listed: true, detail: "absent" }),
    ),
  ).toBe(true)
  expect(
    OwnedConnection.$is("Owned")(
      interpretOwnedConnection({ listed: true, detail: "present" }),
    ),
  ).toBe(true)
  expect(connectionProjectLabels(["abc"], { abc: "Billing" })).toEqual([
    "Billing",
  ])
})

it("separates a stale Studio session from a temporarily unavailable list", () => {
  expect(
    ConnectionList.$is("StaleSession")(
      connectionListRecovery({ data: { code: "UNAUTHORIZED" } }),
    ),
  ).toBe(true)
  expect(
    ConnectionList.$is("StaleSession")(
      connectionListRecovery({ data: { code: "FORBIDDEN" } }),
    ),
  ).toBe(true)
  expect(
    ConnectionList.$is("Unavailable")(
      connectionListRecovery(new Error("network")),
    ),
  ).toBe(true)
})

it("acknowledges revoke only after the connection is gone", () => {
  expect(
    RevokeFeedbackState.$is("Revoked")(
      interpretRevokeResult({ stillListed: false }),
    ),
  ).toBe(true)
  expect(
    RevokeFeedbackState.$is("StillActive")(
      interpretRevokeResult({ stillListed: true }),
    ),
  ).toBe(true)
  expect(
    RevokeFeedbackState.$is("Unknown")(
      interpretRevokeResult({ stillListed: "unknown" }),
    ),
  ).toBe(true)
})

it("distinguishes pending detail, unavailable detail and stale list data", () => {
  expect(
    OwnedConnection.$is("Loading")(
      interpretOwnedConnection({ listed: true, detail: "pending" }),
    ),
  ).toBe(true)
  expect(
    OwnedConnection.$is("Unavailable")(
      interpretOwnedConnection({ listed: true, detail: "unavailable" }),
    ),
  ).toBe(true)
  expect(
    OwnedConnection.$is("Hidden")(
      interpretOwnedConnection({ listed: false, detail: "present" }),
    ),
  ).toBe(true)
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
  expect(RevokeFeedbackState.$is("Revoked")(result)).toBe(true)
})

it("never confirms a revoke from the mutation alone or from a failed refresh", async () => {
  const target = { clientId: "client", authorizationCodeId: "family" }
  const base = {
    target,
    revoke: async () => undefined,
    cancelRead: async () => undefined,
  }
  expect(
    RevokeFeedbackState.$is("StillActive")(
      await Effect.runPromise(
        revokeAndConfirmConnection({ ...base, read: async () => [target] }),
      ),
    ),
  ).toBe(true)
  expect(
    RevokeFeedbackState.$is("Unknown")(
      await Effect.runPromise(
        revokeAndConfirmConnection({
          ...base,
          read: async () => {
            throw new Error("offline")
          },
        }),
      ),
    ),
  ).toBe(true)
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
  expect(RevokeFeedbackState.$is("Revoked")(result)).toBe(true)
})
