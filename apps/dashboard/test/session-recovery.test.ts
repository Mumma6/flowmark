import { Effect } from "effect"
import { describe, expect, it, vi } from "vitest"
import {
  makeSessionRecovery,
  SessionCheckError,
} from "../features/auth/session-recovery"
import { studioReturnPath } from "../features/auth/studio-return-path"

const denied = { data: { code: "UNAUTHORIZED" } }
describe("confirmed session recovery", () => {
  it("deduplicates simultaneous denials and expires once", async () => {
    const verify = vi.fn()
    const expire = vi.fn()
    await Effect.runPromise(
      Effect.gen(function* () {
        const check = yield* makeSessionRecovery({
          hasSession: Effect.sync(verify).pipe(
            Effect.andThen(Effect.sleep(10)),
            Effect.as(false),
          ),
          expire: Effect.sync(expire),
        })
        yield* Effect.all([check(denied), check(denied)], {
          concurrency: "unbounded",
        })
        yield* check(denied)
      }),
    )
    expect(verify).toHaveBeenCalledTimes(1)
    expect(expire).toHaveBeenCalledTimes(1)
  })
  it("does not clear data for an active session, network failure or unrelated error", async () => {
    const expire = vi.fn()
    const verify = vi.fn()
    await Effect.runPromise(
      Effect.gen(function* () {
        const active = yield* makeSessionRecovery({
          hasSession: Effect.sync(verify).pipe(Effect.as(true)),
          expire: Effect.sync(expire),
        })
        yield* active(new Error("Offline"))
        expect(verify).not.toHaveBeenCalled()
        yield* active(denied)
        const unavailable = yield* makeSessionRecovery({
          hasSession: Effect.fail(new SessionCheckError({ cause: "offline" })),
          expire: Effect.sync(expire),
        })
        yield* unavailable(denied)
      }),
    )
    expect(expire).not.toHaveBeenCalled()
  })
  it.each([
    "/",
    "/runs/11111111-1111-4111-8111-111111111111",
    "/settings",
    "/account/help",
  ])("retains a known page: %s", (path) =>
    expect(studioReturnPath(path)).toBe(path),
  )
  it.each([
    "https://example.com",
    "//example.com",
    "/sign-in",
    "/reset-password?token=secret",
    "/settings?token=secret",
    "/runs/../settings",
    "/unknown",
    undefined,
  ])("rejects an unsafe return: %s", (path) =>
    expect(studioReturnPath(path)).toBeUndefined(),
  )
})
