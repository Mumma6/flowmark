import { randomUUID, createHmac } from "node:crypto"
import { Effect } from "effect"
import {
  AUTH_PROXY_IDENTITY_HEADER,
  signAuthProxyIdentity,
} from "@flowmark/db/auth/client-identity"
import { eq, sql } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { createDatabase, authRateLimits } from "@flowmark/db"
import { createFlowmarkAuth } from "@flowmark/db/auth"
import {
  createAuthRateLimitStorage,
  authLimitKey,
} from "../../../../packages/db/src/auth/rate-limit-storage"

const origin = "http://localhost:3001"
const request = (path: string, email: string, extra?: HeadersInit) => {
  const headers = new Headers(extra)
  headers.set("content-type", "application/json")
  headers.set("origin", origin)
  return new Request(`${origin}/api/auth${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      email,
      password: "synthetic-wrong-password",
      name: "Synthetic auth limit user",
    }),
  })
}

describe.skipIf(!process.env.TEST_DATABASE_URL)("durable auth budgets", () => {
  let first: ReturnType<typeof createDatabase>
  let second: ReturnType<typeof createDatabase>
  const secret = `${randomUUID()}${randomUUID()}`
  const makeAuth = (connection: ReturnType<typeof createDatabase>) =>
    createFlowmarkAuth({
      db: connection.db,
      secret,
      baseURL: origin,
      trustedOrigins: [origin],
    })

  beforeAll(() => {
    const url = process.env.TEST_DATABASE_URL!
    expect(["localhost", "127.0.0.1", "[::1]"]).toContain(new URL(url).hostname)
    first = createDatabase(url)
    second = createDatabase(url)
    vi.stubEnv("VERCEL", "")
    vi.stubEnv("FLOWMARK_AUTH_TRUSTED_IP_HEADER", "")
    vi.stubEnv("FLOWMARK_AUTH_PROXY_SECRET", undefined)
  })
  afterAll(async () => {
    await first?.close()
    await second?.close()
    vi.unstubAllEnvs()
  })

  it("atomically shares a fixed-window counter across independent clients under concurrency", async () => {
    const key = `concurrent:${randomUUID()}`
    const a = createAuthRateLimitStorage(first.db, secret)
    const b = createAuthRateLimitStorage(second.db, secret)
    const results = await Promise.all(
      Array.from({ length: 40 }, (_, i) =>
        (i % 2 ? a : b).consume(key, { max: 7, window: 60 }),
      ),
    )
    expect(results.filter((result) => result.allowed)).toHaveLength(7)
    for (const denied of results.filter((result) => !result.allowed)) {
      expect(denied.retryAfter).toBeGreaterThan(0)
      expect(denied.retryAfter).toBeLessThanOrEqual(60)
    }
    const [row] = await first.db
      .select()
      .from(authRateLimits)
      .where(eq(authRateLimits.key, authLimitKey(secret, key)))
    expect(row.count).toBe(7)
    const expires = row.expiresAt
    await b.consume(key, { max: 7, window: 60 })
    const [unchanged] = await first.db
      .select()
      .from(authRateLimits)
      .where(eq(authRateLimits.key, row.key))
    expect(unchanged.expiresAt).toEqual(expires)
    await first.db
      .update(authRateLimits)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(authRateLimits.key, row.key))
    const renewed = await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        (i % 2 ? a : b).consume(key, { max: 7, window: 60 }),
      ),
    )
    expect(renewed.filter((result) => result.allowed)).toHaveLength(7)
  })

  it("enforces account login limits across auth instances with generic responses and no trusted IP", async () => {
    const email = `${randomUUID()}@example.test`
    const a = makeAuth(first)
    const b = makeAuth(second)
    const responses = await Promise.all(
      Array.from({ length: 14 }, (_, i) =>
        (i % 2 ? a : b).handler(
          request("/sign-in/email", i % 2 ? email.toUpperCase() : email, {
            "x-forwarded-for": `203.0.113.${i + 1}`,
          }),
        ),
      ),
    )
    expect(
      responses.filter((response) => response.status === 401),
    ).toHaveLength(10)
    const denied = responses.filter((response) => response.status === 429)
    expect(denied).toHaveLength(4)
    for (const response of denied) {
      expect(Number(response.headers.get("retry-after"))).toBeGreaterThan(0)
      expect(response.headers.get("x-retry-after")).toBe(
        response.headers.get("retry-after"),
      )
      expect(JSON.stringify(await response.json())).not.toContain(email)
    }
    // Missing IP does not put unrelated accounts into one low shared login bucket.
    expect(
      (
        await b.handler(
          request("/sign-in/email", `${randomUUID()}@example.test`),
        )
      ).status,
    ).toBe(401)
  })

  it("bounds direct server API signup calls as well as HTTP signup", async () => {
    const email = `${randomUUID()}@example.test`
    const a = makeAuth(first)
    const b = makeAuth(second)
    for (let i = 0; i < 5; i++) {
      const outcome = await Promise.allSettled([
        a.api.signUpEmail({
          body: {
            email,
            name: "Synthetic duplicate",
            password: "test-password-123",
          },
        }),
      ])
      expect(outcome[0].status).toBe(i === 0 ? "fulfilled" : "rejected")
    }
    const response = await b.handler(request("/sign-up/email", email))
    expect(response.status).toBe(429)
  })

  it("shares the trusted source budget across signed dashboard hops and independent API instances", async () => {
    const proxySecret = `${randomUUID()}${randomUUID()}`
    const salt = `${randomUUID()}${randomUUID()}`
    const a = createFlowmarkAuth({
      db: first.db,
      secret: salt,
      baseURL: origin,
      trustedOrigins: [origin],
    })
    const b = createFlowmarkAuth({
      db: second.db,
      secret: salt,
      baseURL: origin,
      trustedOrigins: [origin],
    })
    const old = process.env.FLOWMARK_AUTH_PROXY_SECRET
    vi.stubEnv("FLOWMARK_AUTH_PROXY_SECRET", proxySecret)
    try {
      const assertion = await Effect.runPromise(
        signAuthProxyIdentity(
          new Request(`${origin}/api/register`, {
            method: "POST",
            headers: { "x-vercel-forwarded-for": "203.0.113.42" },
          }),
          "/api/register",
          { VERCEL: "1", FLOWMARK_AUTH_PROXY_SECRET: proxySecret },
        ),
      )
      const results = await Promise.all(
        Array.from({ length: 25 }, (_, i) =>
          (i % 2 ? a : b).handler(
            request("/sign-up/email", `${randomUUID()}@example.test`, {
              [AUTH_PROXY_IDENTITY_HEADER]: assertion!,
              "x-forwarded-for": `203.0.113.${i + 1}`,
            }),
          ),
        ),
      )
      expect(
        results.filter((response) => response.status === 200),
      ).toHaveLength(20)
      expect(
        results.filter((response) => response.status === 429),
      ).toHaveLength(5)
      for (const response of results.filter(
        (response) => response.status === 429,
      )) {
        expect(Number(response.headers.get("retry-after"))).toBeGreaterThan(0)
      }
    } finally {
      vi.stubEnv("FLOWMARK_AUTH_PROXY_SECRET", old)
    }
  })

  it("bounds service-wide account creation even when email and claimed IP rotate", async () => {
    const salt = `${randomUUID()}${randomUUID()}`
    const a = createFlowmarkAuth({
      db: first.db,
      secret: salt,
      baseURL: origin,
      trustedOrigins: [origin],
    })
    const b = createFlowmarkAuth({
      db: second.db,
      secret: salt,
      baseURL: origin,
      trustedOrigins: [origin],
    })
    const results = await Promise.all(
      Array.from({ length: 30 }, (_, i) =>
        (i % 2 ? a : b).handler(
          request("/sign-up/email", `${randomUUID()}@example.test`, {
            "x-forwarded-for": `203.0.113.${i + 1}`,
          }),
        ),
      ),
    )
    expect(results.filter((response) => response.status === 200)).toHaveLength(
      25,
    )
    expect(results.filter((response) => response.status === 429)).toHaveLength(
      5,
    )
  })

  it("applies recovery and resend limits before account lookup even while delivery is disabled", async () => {
    for (const path of [
      "/request-password-reset",
      "/send-verification-email",
    ]) {
      const email = `${randomUUID()}@example.test`
      const a = makeAuth(first)
      for (let i = 0; i < 3; i++) {
        const response = await a.handler(request(path, email))
        expect(response.status).not.toBe(429)
      }
      const limited = await makeAuth(second).handler(request(path, email))
      expect(limited.status).toBe(429)
    }
  })

  it("expires pseudonymous counters in bounded batches and admits no unbounded key allocation", async () => {
    const expiredKeys = Array.from({ length: 120 }, () =>
      createHmac("sha256", secret).update(randomUUID()).digest("hex"),
    )
    await first.db.insert(authRateLimits).values(
      expiredKeys.map((key) => ({
        key,
        count: 1,
        expiresAt: new Date(Date.now() - 1000),
      })),
    )
    const storage = createAuthRateLimitStorage(first.db, secret)
    await storage.consume(`cleanup:${randomUUID()}`, { max: 1, window: 60 })
    // Each consume includes admission + requested bucket, each pruning up to 100.
    const [{ count }] = await first.db
      .select({ count: sql<number>`count(*)::int` })
      .from(authRateLimits)
      .where(
        sql`${authRateLimits.key} IN (${sql.join(
          expiredKeys.map((key) => sql`${key}`),
          sql`, `,
        )})`,
      )
    expect(count).toBe(0)
    const allocationSecret = randomUUID()
    const admissionKey = authLimitKey(allocationSecret, "admission")
    await first.db.insert(authRateLimits).values({
      key: admissionKey,
      count: 2000,
      expiresAt: new Date(Date.now() + 60000),
    })
    const allocation = createAuthRateLimitStorage(first.db, allocationSecret)
    const key = `new:${randomUUID()}`
    expect(
      (await allocation.consume(key, { max: 10, window: 60 })).allowed,
    ).toBe(false)
    expect(
      await first.db
        .select()
        .from(authRateLimits)
        .where(eq(authRateLimits.key, authLimitKey(allocationSecret, key))),
    ).toEqual([])
  })

  it("fails closed when limit storage is unavailable, without returning success or raw errors", async () => {
    const unreachable = createDatabase(
      "postgresql://127.0.0.1:1/flowmark_auth_unreachable",
    )
    try {
      const response = await makeAuth(unreachable).handler(
        request("/sign-up/email", `${randomUUID()}@example.test`),
      )
      expect(response.status).toBe(503)
      expect(await response.json()).toEqual({
        message: "Authentication is temporarily unavailable.",
      })
    } finally {
      await unreachable.close()
    }
  })
})
