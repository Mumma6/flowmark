import { Effect, Layer, Result } from "effect"
import { expect, it, vi } from "vitest"
import {
  completeRecovery,
  requestRecovery,
  Recovery,
} from "../features/auth/recovery"
import { recoveryLayer } from "../features/auth/recovery-browser-runtime"

const token = "synthetic-preview-token-1234"
const input = {
  token,
  newPassword: "synthetic-password",
  confirmation: "synthetic-password",
}
const failed = <A>(result: Result.Result<A, { readonly reason: string }>) =>
  Result.match(result, {
    onSuccess: () => "unexpected-success",
    onFailure: (error) => error.reason,
  })

it("validates email/password/token input before any HTTP request", async () => {
  const send = vi.fn(() => Effect.void)
  const layer = Layer.succeed(Recovery, { request: send, reset: send })
  const cases = [
    requestRecovery("bad-address"),
    completeRecovery({ ...input, token: "bad" }),
    completeRecovery({ ...input, confirmation: "mismatch" }),
  ]
  const results = await Effect.runPromise(
    Effect.forEach(cases, (operation) =>
      operation.pipe(Effect.provide(layer), Effect.result),
    ),
  )
  expect(results.every(Result.isFailure)).toBe(true)
  expect(send).not.toHaveBeenCalled()
})

it("uses fixed same-origin endpoints and a fixed canonical reset callback", async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockImplementation(async () => Response.json({ status: true }))
  const layer = recoveryLayer("https://dashboard.example", fetcher)
  await Effect.runPromise(
    requestRecovery(" person@example.test ").pipe(Effect.provide(layer)),
  )
  expect(fetcher.mock.calls[0][0]).toBe("/api/auth/request-password-reset")
  expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body))).toEqual({
    email: "person@example.test",
    redirectTo: "https://dashboard.example/reset-password",
  })
  await Effect.runPromise(completeRecovery(input).pipe(Effect.provide(layer)))
  expect(fetcher.mock.calls[1][0]).toBe("/api/auth/reset-password")
  expect(JSON.parse(String(fetcher.mock.calls[1][1]?.body))).toEqual({
    token,
    newPassword: input.newPassword,
  })
  expect(fetcher.mock.calls[1][1]).toMatchObject({
    cache: "no-store",
    redirect: "error",
    credentials: "same-origin",
  })
})

it("handles throttling, invalid links and ambiguous completion without retries or provider text", async () => {
  const scenarios = [
    {
      response: () =>
        Response.json(
          { code: "INVALID_TOKEN", message: token },
          { status: 400 },
        ),
      expected: "invalid-link",
    },
    {
      response: () => Response.json({ message: token }, { status: 429 }),
      expected: "rate-limited",
    },
    {
      response: () => Response.json({ message: token }, { status: 503 }),
      expected: "uncertain",
    },
    {
      response: () => Response.json({ unexpected: token }),
      expected: "uncertain",
    },
  ]
  await Effect.runPromise(
    Effect.forEach(scenarios, (scenario) =>
      Effect.gen(function* () {
        const fetcher = vi
          .fn<typeof fetch>()
          .mockImplementation(async () => scenario.response())
        const result = yield* completeRecovery(input).pipe(
          Effect.provide(recoveryLayer("https://dashboard.example", fetcher)),
          Effect.result,
        )
        expect(failed(result)).toBe(scenario.expected)
        expect(fetcher).toHaveBeenCalledTimes(1)
        expect(JSON.stringify(result)).not.toContain(token)
      }),
    ),
  )
  const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new Error(token))
  const result = await Effect.runPromise(
    completeRecovery(input).pipe(
      Effect.provide(recoveryLayer("https://dashboard.example", fetcher)),
      Effect.result,
    ),
  )
  expect(failed(result)).toBe("uncertain")
  expect(fetcher).toHaveBeenCalledTimes(1)
  expect(JSON.stringify(result)).not.toContain(token)
})
