import { Effect, Layer, Result } from "effect"
import { expect, it } from "vitest"
import {
  authenticate,
  BrowserAuth,
  DashboardAuthError,
} from "../features/auth/operations"

const makeAuth = (
  events: string[],
  overrides: Partial<BrowserAuth["Service"]> = {},
) =>
  Layer.succeed(BrowserAuth, {
    register: () =>
      Effect.sync(() => {
        events.push("register")
      }),
    signIn: () =>
      Effect.sync(() => {
        events.push("signIn")
      }),
    signOut: () => Effect.void,
    updateName: () => Effect.void,
    changePassword: () => Effect.void,
    ...overrides,
  })
const credentials = {
  name: "Owner",
  email: "owner@example.invalid",
  password: "synthetic-test-only",
}

it("registers before signing in and opens project setup only after both succeed", async () => {
  const events: string[] = []
  const program = authenticate("sign-up", credentials).pipe(
    Effect.provide(makeAuth(events)),
  )
  expect(events).toEqual([])
  expect(await Effect.runPromise(program)).toBe("/settings?section=projects")
  expect(events).toEqual(["register", "signIn"])
})
it("does not register an existing account during sign-in", async () => {
  const events: string[] = []
  expect(
    await Effect.runPromise(
      authenticate("sign-in", credentials).pipe(
        Effect.provide(makeAuth(events)),
      ),
    ),
  ).toBe("/")
  expect(events).toEqual(["signIn"])
})
it("stops before sign-in on registration failure and keeps the typed cause", async () => {
  const events: string[] = []
  const failure = new DashboardAuthError({
    operation: "register",
    reason: "Registration unavailable",
    cause: new Error("synthetic"),
  })
  const result = await Effect.runPromise(
    authenticate("sign-up", credentials).pipe(
      Effect.provide(
        makeAuth(events, { register: () => Effect.fail(failure) }),
      ),
      Effect.result,
    ),
  )
  Result.match(result, {
    onFailure: (error) => expect(error).toBe(failure),
    onSuccess: () => {
      throw new Error("Unexpected sign-in success")
    },
  })
  expect(events).toEqual([])
})
