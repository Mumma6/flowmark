import { Effect, Layer, Result } from "effect"
import { expect, it } from "vitest"
import { normalizeAccountName, validatePasswordChange } from "../features/settings/account-form"
import {
  BrowserAuth,
  changeAccountPassword,
  updateAccountName,
} from "../features/auth/operations"

const makeAuth = (calls: string[]) =>
  Layer.succeed(BrowserAuth, {
    register: () => Effect.void,
    signIn: () => Effect.void,
    sendVerification: () => Effect.void,
    signOut: () => Effect.void,
    updateName: (name) =>
      Effect.sync(() => {
        calls.push(name)
      }),
    changePassword: () =>
      Effect.sync(() => {
        calls.push("password")
      }),
  })

it("trims and bounds display names before update", async () => {
  const calls: string[] = []
  const result = await Effect.runPromise(
    updateAccountName("  Ada Lovelace  ").pipe(
      Effect.provide(makeAuth(calls)),
      Effect.result,
    ),
  )
  Result.match(result, {
    onFailure: () => {
      throw new Error("Expected name update to succeed")
    },
    onSuccess: (name) => expect(name).toBe("Ada Lovelace"),
  })
  expect(calls).toEqual(["Ada Lovelace"])
})

it("rejects blank display names", async () => {
  const result = await Effect.runPromise(
    normalizeAccountName("   ").pipe(Effect.result),
  )
  expect(Result.isFailure(result)).toBe(true)
})

it("rejects identical current and new passwords", async () => {
  const result = await Effect.runPromise(
    validatePasswordChange({
      currentPassword: "same-value-123",
      newPassword: "same-value-123",
    }).pipe(Effect.result),
  )
  expect(Result.isFailure(result)).toBe(true)
})

it("does not call the provider when password input is invalid", async () => {
  const calls: string[] = []
  const result = await Effect.runPromise(
    changeAccountPassword({
      currentPassword: "",
      newPassword: "short",
    }).pipe(Effect.provide(makeAuth(calls)), Effect.result),
  )
  expect(Result.isFailure(result)).toBe(true)
  expect(calls).toEqual([])
})
