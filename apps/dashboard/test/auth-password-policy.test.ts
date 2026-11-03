import { expect, it, vi } from "vitest"
import { Result } from "effect"
import { authClient } from "../features/auth/auth-client"
import { runBrowserAuth } from "../features/auth/auth-browser-runtime"
import { changeAccountPassword } from "../features/auth/operations"

vi.mock("../features/auth/auth-client", () => ({
  authClient: { changePassword: vi.fn() },
}))

const input = { currentPassword: "synthetic-old", newPassword: "synthetic-new" }

it("password change asks the provider to revoke other sessions", async () => {
  vi.mocked(authClient.changePassword).mockResolvedValueOnce({
    data: null,
    error: null,
  } as never)
  const result = await runBrowserAuth(changeAccountPassword(input))
  expect(Result.isSuccess(result)).toBe(true)
  expect(authClient.changePassword).toHaveBeenLastCalledWith({
    ...input,
    revokeOtherSessions: true,
  })
})

it("a rejected password change remains a failure and is not retried", async () => {
  vi.mocked(authClient.changePassword).mockClear()
  vi.mocked(authClient.changePassword).mockResolvedValueOnce({
    error: { message: "Password change could not be accepted." },
  } as never)
  const result = await runBrowserAuth(changeAccountPassword(input))
  expect(Result.isFailure(result)).toBe(true)
  expect(authClient.changePassword).toHaveBeenCalledTimes(1)
})
