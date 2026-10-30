import { inspect } from "node:util"
import { randomUUID } from "node:crypto"
import { afterEach, describe, expect, it, vi } from "vitest"
import { POST } from "../../app/v1/events/route"
import { GET as health } from "../../app/api/health/route"

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe.skipIf(!process.env.TEST_DATABASE_URL)("unreachable storage", () => {
  it("keeps health live while ingestion fails safely with 503", async () => {
    // Port 1 has no test database. Never stop an existing development service.
    const target = new URL("postgresql://127.0.0.1:1/flowmark_diagnostics")
    target.username = randomUUID()
    target.password = randomUUID()
    vi.stubEnv("DATABASE_URL", target.href)
    vi.stubEnv("FLOWMARK_DEMO_MODE", "false")
    vi.stubEnv("VERCEL_ENV", "")
    const log = vi.spyOn(console, "error").mockImplementation(() => {})
    vi.stubEnv("FLOWMARK_DEPLOYMENT_SHA", "b".repeat(40))
    const alive = health()
    expect(alive.status).toBe(200)
    expect(await alive.json()).toEqual({
      status: "ok",
      service: "flowmark-api",
      commit: "b".repeat(40),
    })
    expect(log).not.toHaveBeenCalled()
    const response = await POST(
      new Request("http://localhost/v1/events", {
        method: "POST",
        headers: { authorization: `Bearer ${randomUUID()}` },
        body: JSON.stringify({
          eventId: randomUUID(),
          event: {
            type: "started",
            workflow: "diagnostics.failure",
            runId: randomUUID(),
            timestamp: new Date().toISOString(),
          },
        }),
      }),
    )
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({
      error: "Event storage is unavailable.",
    })
    expect(log).toHaveBeenCalledOnce()
    expect(log.mock.calls[0][1]).toMatchObject({
      failures: [
        {
          type: "PersistenceError",
          operation: "authenticate",
          code: "ECONNREFUSED",
        },
      ],
    })
    const logged = inspect(log.mock.calls, { depth: 30 })
    // Boolean assertions avoid reprinting unsafe diagnostic text on failure.
    expect(logged.includes(target.href)).toBe(false)
    expect(logged.includes(target.password)).toBe(false)
    expect(/select\s|insert\s|key_hash/i.test(logged)).toBe(false)
  })
})
