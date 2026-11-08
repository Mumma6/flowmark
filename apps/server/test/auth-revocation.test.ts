import { afterEach, expect, it, vi } from "vitest"
import { Effect } from "effect"
import { createFlowmarkAuth } from "@flowmark/auth"
import {
  DatabaseError,
  DatabaseOperation,
  revokeAllAgentAccessConnectionsForUser,
} from "@flowmark/db/persistence"
import { getAuth, resetAuthCacheForTests } from "../src/auth"

vi.mock("@flowmark/auth", async (original) => ({
  ...(await original<typeof import("@flowmark/auth")>()),
  createFlowmarkAuth: vi.fn(() => ({})),
}))
vi.mock("@flowmark/db", async (original) => ({
  ...(await original<typeof import("@flowmark/db")>()),
  createDatabase: vi.fn(() => ({ db: {} })),
}))
vi.mock("@flowmark/db/persistence", async (original) => ({
  ...(await original<typeof import("@flowmark/db/persistence")>()),
  revokeAllAgentAccessConnectionsForUser: vi.fn(),
}))

afterEach(() => {
  resetAuthCacheForTests()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

it("propagates failed delegated revocation and logs only safe operation context", async () => {
  vi.stubEnv("DATABASE_URL", "postgres://unused:unused@127.0.0.1:1/unused")
  vi.stubEnv("VERCEL_ENV", "")
  vi.stubEnv("BETTER_AUTH_URL", "http://127.0.0.1:3901")
  vi.stubEnv("FLOWMARK_DASHBOARD_ORIGIN", "http://127.0.0.1:3901")
  vi.stubEnv("BETTER_AUTH_SECRET", "synthetic-auth-secret-for-revocation-test")
  vi.stubEnv("FLOWMARK_AGENT_ACCESS_ENABLED", "false")
  vi.stubEnv("RESEND_API_KEY", "")
  vi.stubEnv("FLOWMARK_EMAIL_FROM", "")
  vi.stubEnv("FLOWMARK_EMAIL_REPLY_TO", "")
  vi.stubEnv("FLOWMARK_EMAIL_ENVIRONMENT", "")
  const log = vi.spyOn(console, "error").mockImplementation(() => undefined)
  vi.mocked(revokeAllAgentAccessConnectionsForUser).mockReturnValue(
    Effect.fail(
      new DatabaseError({
        operation: DatabaseOperation.RevokeAllAgentAccessConnectionsForUser,
        cause: new Error("synthetic-private-driver-detail"),
      }),
    ),
  )
  await Effect.runPromise(getAuth())
  const callback =
    vi.mocked(createFlowmarkAuth).mock.calls[0]?.[0]
      .onRevokeDelegatedAgentAccess
  expect(callback).toBeDefined()
  await expect(callback!("synthetic-user")).rejects.toBeDefined()
  expect(log).toHaveBeenCalledWith(
    "[Flowmark auth] Delegated agent access revocation failed",
    {
      operation: "revoke-delegated-agent-access",
    },
  )
  expect(JSON.stringify(log.mock.calls)).not.toContain(
    "synthetic-private-driver-detail",
  )
})
