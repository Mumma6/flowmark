import { Effect, Layer, Result } from "effect"
import { expect, it } from "vitest"
import { JoinWaitlist } from "../../src/features/waitlist/join-waitlist.js"
import { WaitlistRepository } from "../../src/features/waitlist/waitlist-repository.js"
import {
  WaitlistWelcomeEmail,
  WaitlistWelcomeError,
} from "../../src/features/waitlist/welcome-email.js"
import {
  InvalidInput,
  ManagementRateLimited,
  PersistenceError,
} from "../../src/errors.js"

const expectJoinFailure = (
  result: Result.Result<unknown, unknown>,
  ErrorClass: abstract new (...args: never[]) => object,
  fields?: object,
) => {
  expect(Result.isFailure(result)).toBe(true)
  if (Result.isFailure(result)) {
    expect(result.failure).toBeInstanceOf(ErrorClass)
    if (fields) {
      expect(result.failure).toMatchObject(fields)
    }
  }
}

const fixture = (
  overrides: Partial<WaitlistRepository["Service"]> = {},
  deliveryOverrides: Partial<WaitlistWelcomeEmail["Service"]> = {},
) => {
  const emails: string[] = []
  const sent: { to: string; id: string }[] = []
  let submitted = false
  const id = "12345678-1234-4234-8234-123456789abc"
  const repository = Layer.succeed(WaitlistRepository, {
    join: (email) =>
      Effect.sync(() => {
        emails.push(email)
        return { id, startedAt: Date.now(), submitted }
      }),
    submitWelcome: () =>
      Effect.sync(() => {
        submitted = true
      }),
    budget: () => Effect.succeed({ allowed: true, retryAfter: null }),
    ...overrides,
  })
  const delivery = Layer.succeed(WaitlistWelcomeEmail, {
    send: (to, messageId) =>
      Effect.sync(() => {
        sent.push({ to, id: messageId })
      }),
    ...deliveryOverrides,
  })
  const layer = JoinWaitlist.layer.pipe(
    Layer.provide(repository),
    Layer.provide(delivery),
  )
  const join = (input: unknown) =>
    Effect.runPromise(
      Effect.result(
        Effect.flatMap(JoinWaitlist, (service) => service.join(input)).pipe(
          Effect.provide(layer),
        ),
      ),
    )
  return { emails, sent, join }
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
  expect(f.sent).toEqual([
    { to: "person@example.com", id: "12345678-1234-4234-8234-123456789abc" },
  ])
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
  expectJoinFailure(await f.join(input), InvalidInput)
  expect(f.emails).toEqual([])
})
it("does not insert after a denied budget and preserves retry timing", async () => {
  const f = fixture({
    budget: () => Effect.succeed({ allowed: false, retryAfter: 17 }),
  })
  expectJoinFailure(
    await f.join({ email: "person@example.com" }),
    ManagementRateLimited,
    { retryAfter: 17 },
  )
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
  expectJoinFailure(
    await f.join({ email: "person@example.com" }),
    PersistenceError,
  )
})

it("does not resend an uncertain submission after the provider retry window", async () => {
  const f = fixture({
    join: () =>
      Effect.succeed({
        id: "12345678-1234-4234-8234-123456789abc",
        startedAt: Date.now() - 24 * 60 * 60 * 1000,
        submitted: false,
      }),
  })
  expectJoinFailure(
    await f.join({ email: "person@example.com" }),
    WaitlistWelcomeError,
    { reason: "retry-window-expired" },
  )
  expect(f.sent).toEqual([])
})

it("preserves registration and reuses the same message identity after delivery failure", async () => {
  let attempt = 0
  const ids: string[] = []
  const f = fixture(
    {},
    {
      send: (_to, id) =>
        Effect.gen(function* () {
          ids.push(id)
          attempt += 1
          if (attempt === 1) {
            return yield* new WaitlistWelcomeError({ reason: "delivery" })
          }
        }),
    },
  )
  expectJoinFailure(
    await f.join({ email: "person@example.com" }),
    WaitlistWelcomeError,
  )
  expect(await f.join({ email: "person@example.com" })).toEqual(
    Result.succeed({ ok: true }),
  )
  expect(ids).toHaveLength(2)
  expect(ids[0]).toBe(ids[1])
  expect(await f.join({ email: "person@example.com" })).toEqual(
    Result.succeed({ ok: true }),
  )
  expect(ids).toHaveLength(2)
})
it("does not report success when recording accepted delivery fails", async () => {
  const f = fixture({
    submitWelcome: () =>
      Effect.fail(
        new PersistenceError({
          operation: "submit-welcome",
          cause: "storage unavailable",
        }),
      ),
  })
  expectJoinFailure(
    await f.join({ email: "person@example.com" }),
    PersistenceError,
  )
  expect(f.sent).toHaveLength(1)
})
