import { Effect, Layer, Result } from "effect"
import { expect, it } from "vitest"
import { JoinWaitlist } from "../../src/features/waitlist/join-waitlist.js"
import { WaitlistRepository } from "../../src/features/waitlist/waitlist-repository.js"
import { PersistenceError } from "../../src/errors.js"

const fixture = (overrides: Partial<WaitlistRepository["Service"]> = {}) => {
  const emails: string[] = []
  const repository = Layer.succeed(WaitlistRepository, {
    join: (email) =>
      Effect.sync(() => {
        emails.push(email)
      }),
    budget: () => Effect.succeed({ allowed: true, retryAfter: null }),
    ...overrides,
  })
  const layer = JoinWaitlist.layer.pipe(Layer.provide(repository))
  const join = (input: unknown) =>
    Effect.runPromise(
      Effect.result(
        Effect.flatMap(JoinWaitlist, (service) => service.join(input)).pipe(
          Effect.provide(layer),
        ),
      ),
    )
  return { emails, join }
}
it("normalizes email and returns the same public success for repeated joins", async () => {
  const f = fixture()
  expect(await f.join({ email: "  Person@Example.COM  " })).toEqual(
    Result.succeed({ ok: true }),
  )
  expect(await f.join({ email: "person@example.com" })).toEqual(
    Result.succeed({ ok: true }),
  )
  expect(f.emails).toEqual(["person@example.com", "person@example.com"])
})
it.each([
  null,
  {},
  { email: 5 },
  { email: "" },
  { email: "no-at-sign" },
  { email: "a@b" },
  { email: "a b@example.com" },
  { email: "a@b@example.com" },
  { email: "a".repeat(255) + "@example.com" },
])("rejects invalid input before using persistence: %j", async (input) => {
  const f = fixture({
    budget: () => Effect.die("invalid input must not consume budget"),
  })
  expect(await f.join(input)).toMatchObject({
    _tag: "Failure",
    failure: { _tag: "InvalidInput" },
  })
  expect(f.emails).toEqual([])
})
it("does not insert after a denied budget and preserves retry timing", async () => {
  const f = fixture({
    budget: () => Effect.succeed({ allowed: false, retryAfter: 17 }),
  })
  expect(await f.join({ email: "person@example.com" })).toMatchObject({
    _tag: "Failure",
    failure: { _tag: "ManagementRateLimited", retryAfter: 17 },
  })
  expect(f.emails).toEqual([])
})
it("does not convert a storage failure into a successful subscription", async () => {
  const f = fixture({
    join: () =>
      Effect.fail(
        new PersistenceError({
          operation: "join-waitlist",
          cause: "private driver failure",
        }),
      ),
  })
  expect(await f.join({ email: "person@example.com" })).toMatchObject({
    _tag: "Failure",
    failure: { _tag: "PersistenceError" },
  })
})
