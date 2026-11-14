import { Effect, Layer } from "effect"
import { beforeEach, expect, it, vi } from "vitest"
import { JoinWaitlist } from "@flowmark/api"
import { WaitlistRepository } from "@flowmark/api"
import { PersistenceError } from "@flowmark/api"

const state = vi.hoisted(() => ({
  emails: new Set<string>(),
  allowed: true,
  failure: false,
}))
vi.mock("@flowmark/api", async (original) => {
  const api = await original<typeof import("@flowmark/api")>()
  return {
    ...api,
    runApi: (operation: Effect.Effect<unknown, unknown, JoinWaitlist>) =>
      Effect.runPromiseExit(
        operation.pipe(
          Effect.provide(
            JoinWaitlist.layer.pipe(
              Layer.provide(
                Layer.succeed(WaitlistRepository, {
                  budget: () =>
                    Effect.succeed({
                      allowed: state.allowed,
                      retryAfter: state.allowed ? null : 12,
                    }),
                  join: (email) =>
                    state.failure
                      ? Effect.fail(
                          new PersistenceError({
                            operation: "join-waitlist",
                            cause: "private email or driver detail",
                          }),
                        )
                      : Effect.sync(() => {
                          state.emails.add(email)
                        }),
                }),
              ),
            ),
          ),
        ),
      ),
  }
})
import { handleWaitlist } from "../../src/adapters/waitlist-http"
const request = (body: unknown) =>
  new Request("http://localhost/api/waitlist", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  })
beforeEach(() => {
  state.emails.clear()
  state.allowed = true
  state.failure = false
})
it("accepts anonymous joins and returns indistinguishable success for duplicates", async () => {
  const first = await handleWaitlist(
    request({ email: " PERSON@example.test " }),
  )
  const second = await handleWaitlist(request({ email: "person@example.test" }))
  expect(first.status).toBe(200)
  expect(await first.json()).toEqual({ ok: true })
  expect(await second.json()).toEqual({ ok: true })
  expect(second.headers.get("cache-control")).toBe("no-store")
  expect(state.emails.size).toBe(1)
})
it("rejects malformed JSON, invalid emails and oversized bodies", async () => {
  expect((await handleWaitlist(request({ email: "invalid" }))).status).toBe(400)
  expect(
    (
      await handleWaitlist(
        new Request("http://localhost/api/waitlist", {
          method: "POST",
          body: "{",
        }),
      )
    ).status,
  ).toBe(400)
  expect(
    (await handleWaitlist(request({ email: "a".repeat(65537) }))).status,
  ).toBe(400)
  expect(state.emails.size).toBe(0)
})
it("returns 429 with Retry-After without inserting", async () => {
  state.allowed = false
  const response = await handleWaitlist(
    request({ email: "person@example.test" }),
  )
  expect(response.status).toBe(429)
  expect(response.headers.get("retry-after")).toBe("12")
  expect(state.emails.size).toBe(0)
})
it("returns a safe failure instead of success when persistence fails", async () => {
  state.failure = true
  const response = await handleWaitlist(
    request({ email: "person@example.test" }),
  )
  expect(response.status).toBe(503)
  expect(await response.text()).not.toContain("private")
})
