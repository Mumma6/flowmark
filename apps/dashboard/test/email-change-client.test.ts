import { Effect, Result } from "effect"
import { expect, it } from "vitest"
import {
  BrowserEmailChange,
  browserEmailChangeLayer,
} from "../features/settings/email-change/browser-runtime"

const run = (body: unknown, status = 200) =>
  Effect.runPromise(
    Effect.flatMap(BrowserEmailChange, (service) =>
      service.request({
        currentSessionId: "current",
        newEmail: "new@example.test",
        password: "private",
      }),
    ).pipe(
      Effect.provide(
        browserEmailChangeLayer(async (_url, options) => {
          expect(options?.credentials).toBe("same-origin")
          expect(options?.cache).toBe("no-store")
          expect(options?.redirect).toBe("error")
          return Response.json(body, { status })
        }),
      ),
      Effect.result,
    ),
  )
it("preserves safe server failure messages for password and rate-limit recovery", async () => {
  const result = await run(
    { message: "Current password was not accepted." },
    400,
  )
  Result.match(result, {
    onSuccess: () => expect.unreachable(),
    onFailure: (failure) =>
      expect(failure.message).toBe("Current password was not accepted."),
  })
})
it("requires a true acknowledgement before reporting completion", async () => {
  for (const body of [{}, { requested: false }, { requested: "true" }, null]) {
    expect(Result.isFailure(await run(body))).toBe(true)
  }
  expect(Result.isSuccess(await run({ requested: true }))).toBe(true)
})
it("rejects malformed status instead of displaying another shape as account state", async () => {
  const result = await Effect.runPromise(
    Effect.flatMap(BrowserEmailChange, (service) => service.status()).pipe(
      Effect.provide(
        browserEmailChangeLayer(async () => Response.json({ available: true })),
      ),
      Effect.result,
    ),
  )
  expect(Result.isFailure(result)).toBe(true)
})
