import { ReadPublicPeriod, PublicReadFailure } from "@flowmark/api"
import { Effect, Layer } from "effect"
import { expect, it } from "vitest"
import { handlePublicPeriodRead } from "../../src/adapters/public-period-read"

it("cancels the period application scope on caller disconnect", async () => {
  const controller = new AbortController()
  let interrupted = false
  const layer = Layer.succeed(ReadPublicPeriod, {
    read: () =>
      Effect.never.pipe(
        Effect.ensuring(
          Effect.sync(() => {
            interrupted = true
          }),
        ),
      ),
  })
  const request = new Request("http://localhost/v1/read/period", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
    signal: controller.signal,
  })
  const result = handlePublicPeriodRead(request, layer)
  const reason = new Error("synthetic disconnect")
  setTimeout(() => controller.abort(reason), 10)
  await expect(result).rejects.toBe(reason)
  expect(interrupted).toBe(true)
})

it("maps period failures through the same safe error envelope", async () => {
  const response = await handlePublicPeriodRead(
    new Request("http://localhost/v1/read/period", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    }),
    Layer.succeed(ReadPublicPeriod, {
      read: () =>
        Effect.fail(
          new PublicReadFailure({
            code: "RATE_LIMITED",
            retryAfterSeconds: 12,
          }),
        ),
    }),
  )
  expect(response.status).toBe(429)
  expect(response.headers.get("Retry-After")).toBe("12")
  expect(response.headers.get("Cache-Control")).toBe("no-store")
  expect((await response.json()).error.code).toBe("RATE_LIMITED")
})
