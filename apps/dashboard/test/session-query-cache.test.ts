import { TRPCClientError } from "@trpc/client"
import { afterEach, expect, it, vi } from "vitest"
import { authClient } from "../features/auth/auth-client"
import { createDashboardQueryClient } from "../features/platform/api-browser-client"
import { DashboardTransportError } from "../features/platform/api-transport-errors"

vi.mock("../features/auth/auth-client", () => ({
  authClient: { getSession: vi.fn() },
}))
afterEach(() => vi.resetAllMocks())

it("clears cached private evidence after confirmed expiry and does not retry the request", async () => {
  vi.mocked(authClient.getSession).mockResolvedValue({
    data: null,
    error: null,
  })
  const expired = vi.fn()
  const client = createDashboardQueryClient(expired)
  client.setQueryData(["private-evidence"], { synthetic: "private" })
  let aborted = false
  const pending = client.fetchQuery({
    queryKey: ["in-flight-private-evidence"],
    queryFn: ({ signal }) =>
      new Promise((_, reject) => {
        signal.addEventListener(
          "abort",
          () => {
            aborted = true
            reject(new Error("Cancelled synthetic request"))
          },
          { once: true },
        )
      }),
  })
  const cancelled = expect(pending).rejects.toThrow()
  const request = vi.fn(() =>
    Promise.reject(
      TRPCClientError.from(
        new DashboardTransportError({ status: 401, message: "Sign in" }),
      ),
    ),
  )
  await expect(
    client.fetchQuery({ queryKey: ["denied"], queryFn: request }),
  ).rejects.toThrow()
  await vi.waitFor(() => expect(expired).toHaveBeenCalledOnce())
  expect(request).toHaveBeenCalledOnce()
  expect(client.getQueryCache().getAll()).toHaveLength(0)
  await cancelled
  expect(aborted).toBe(true)
  expect(authClient.getSession).toHaveBeenCalledWith({
    query: { disableCookieCache: true },
  })
})

it("preserves the active session and cache on project denial without replaying a mutation", async () => {
  const now = new Date()
  vi.mocked(authClient.getSession).mockResolvedValue({
    data: {
      user: {
        id: "synthetic",
        name: "Synthetic",
        email: "synthetic@example.invalid",
        emailVerified: false,
        createdAt: now,
        updatedAt: now,
      },
      session: {
        id: "synthetic-session",
        token: "synthetic-token",
        userId: "synthetic",
        expiresAt: new Date(now.getTime() + 60000),
        createdAt: now,
        updatedAt: now,
      },
    },
    error: null,
  })
  const expired = vi.fn()
  const client = createDashboardQueryClient(expired)
  client.setQueryData(["permitted-evidence"], "retained")
  const request = vi.fn(() =>
    Promise.reject(
      Object.assign(new Error("Denied"), { data: { code: "FORBIDDEN" } }),
    ),
  )
  const mutation = client
    .getMutationCache()
    .build(client, { mutationFn: request })
  await expect(mutation.execute(undefined)).rejects.toThrow("Denied")
  await vi.waitFor(() => expect(authClient.getSession).toHaveBeenCalledOnce())
  expect(expired).not.toHaveBeenCalled()
  expect(client.getQueryData(["permitted-evidence"])).toBe("retained")
  expect(request).toHaveBeenCalledOnce()
  client.clear()
})
