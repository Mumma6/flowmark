import { Effect, Result } from "effect"
import { afterEach, expect, it, vi } from "vitest"
import { authClient } from "../features/auth/auth-client"
import { runBrowserAuth } from "../features/auth/auth-browser-runtime"
import { requestAccountEmailVerification } from "../features/auth/operations"

vi.mock("../features/auth/auth-client", () => ({
  authClient: { sendVerificationEmail: vi.fn() },
}))
afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetAllMocks()
})
const user = { email: "person@example.test", emailVerified: false }
it("requests only the signed-in address and fixes the callback to account settings", async () => {
  vi.stubGlobal("window", { location: { origin: "https://app.example.test" } })
  vi.mocked(authClient.sendVerificationEmail).mockResolvedValueOnce({
    data: { status: true },
    error: null,
  } as never)
  const effect = requestAccountEmailVerification(user.email)
  expect(authClient.sendVerificationEmail).not.toHaveBeenCalled()
  const result = await runBrowserAuth(effect)
  expect(Result.isSuccess(result)).toBe(true)
  expect(authClient.sendVerificationEmail).toHaveBeenCalledExactlyOnceWith({
    email: user.email,
    callbackURL:
      "https://app.example.test/settings?section=account&emailVerification=complete",
  })
})
it("retains rate-limit/server failures and never retries or displays provider payloads", async () => {
  vi.stubGlobal("window", { location: { origin: "https://app.example.test" } })
  await Effect.runPromise(
    Effect.forEach([429, 503], (status) =>
      Effect.gen(function* () {
        vi.mocked(authClient.sendVerificationEmail).mockClear()
        vi.mocked(authClient.sendVerificationEmail).mockResolvedValueOnce({
          error: { status, message: "synthetic-private-provider-value" },
        } as never)
        const result = yield* Effect.promise(() =>
          runBrowserAuth(requestAccountEmailVerification(user.email)),
        )
        expect(Result.isFailure(result)).toBe(true)
        expect(JSON.stringify(result)).not.toContain(
          "synthetic-private-provider-value",
        )
        expect(authClient.sendVerificationEmail).toHaveBeenCalledTimes(1)
      }),
    ),
  )
})
