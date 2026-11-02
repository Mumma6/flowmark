import { randomUUID } from "node:crypto"
import { eq } from "drizzle-orm"
import { Effect } from "effect"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { createDatabase, session, user } from "@flowmark/db"
import { createFlowmarkAuth } from "@flowmark/db/auth"
import { seedLocalAuthUser } from "../../../../packages/db/src/cli/seed-local-auth"
import { LOCAL_DEV_EMAIL, LOCAL_DEV_PASSWORD } from "@flowmark/db/demo"
import { getAuth } from "../../src/auth"
import { appRouter } from "../../src/adapters/trpc"
import { POST as register } from "../../app/api/register/route"

const origin = "http://localhost:3001"
const request = (path: string, body: unknown, extra?: HeadersInit) => {
  const headers = new Headers(extra)
  if (!headers.has("origin")) {
    headers.set("origin", origin)
  }
  headers.set("content-type", "application/json")
  return new Request(`${origin}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  })
}
const signup = () => ({
  name: "Auth perimeter test",
  email: `${randomUUID()}@example.test`,
  password: randomUUID(),
})
const cookieOf = (response: Response) =>
  response.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ")
const caller = (cookie: string) =>
  appRouter.createCaller({
    request: new Request(`${origin}/api/trpc`, { headers: { cookie } }),
  })

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  "provider-owned auth perimeter",
  () => {
    let connection: ReturnType<typeof createDatabase>
    let auth: ReturnType<typeof createFlowmarkAuth>

    beforeAll(async () => {
      const url = process.env.TEST_DATABASE_URL!
      expect(["localhost", "127.0.0.1", "[::1]"]).toContain(
        new URL(url).hostname,
      )
      vi.stubEnv("DATABASE_URL", url)
      vi.stubEnv("BETTER_AUTH_SECRET", `${randomUUID()}${randomUUID()}`)
      vi.stubEnv("BETTER_AUTH_URL", origin)
      vi.stubEnv("FLOWMARK_DASHBOARD_ORIGIN", origin)
      vi.stubEnv("FLOWMARK_DEMO_MODE", "false")
      vi.stubEnv("VERCEL_ENV", "")
      connection = createDatabase(url)
      auth = await Effect.runPromise(getAuth())
    })

    afterAll(async () => {
      await connection?.close()
      vi.unstubAllEnvs()
    })

    it("cannot bypass provider verification even with production-shaped demo misconfiguration", async () => {
      const body = signup()
      expect((await register(request("/api/register", body))).status).toBe(200)
      const previousMode = process.env.FLOWMARK_DEMO_MODE
      const previousNode = process.env.NODE_ENV
      const previousVercel = process.env.VERCEL_ENV
      try {
        for (const shape of [
          { node: "production", vercel: "production" },
          { node: "development", vercel: "preview" },
          { node: "development", vercel: "" },
        ]) {
          vi.stubEnv("FLOWMARK_DEMO_MODE", "true")
          vi.stubEnv("NODE_ENV", shape.node)
          vi.stubEnv("VERCEL_ENV", shape.vercel)
          const candidate = createFlowmarkAuth({
            db: connection.db,
            secret: process.env.BETTER_AUTH_SECRET!,
            baseURL: origin,
            trustedOrigins: [origin],
          })
          const context = await candidate.$context
          Object.assign(context.options.emailAndPassword!, {
            requireEmailVerification: true,
          })
          const response = await candidate.handler(
            request("/api/auth/sign-in/email", body),
          )
          expect(response.status).toBe(403)
          expect(await response.json()).toMatchObject({
            code: "EMAIL_NOT_VERIFIED",
          })
          expect(response.headers.has("set-cookie")).toBe(false)
          expect(
            (
              await candidate.handler(
                request("/api/auth/sign-in/email", {
                  email: "local@dev",
                  password: LOCAL_DEV_PASSWORD,
                }),
              )
            ).status,
          ).toBe(400)
        }
      } finally {
        vi.stubEnv("FLOWMARK_DEMO_MODE", previousMode)
        vi.stubEnv("NODE_ENV", previousNode)
        vi.stubEnv("VERCEL_ENV", previousVercel)
      }
    })

    it("enforces origin and first-login CSRF checks on both signup paths", async () => {
      const log = vi.spyOn(console, "error").mockImplementation(() => {})
      for (const path of ["/api/register", "/api/auth/sign-up/email"]) {
        const invoke = path === "/api/register" ? register : auth.handler
        for (const extra of [
          new Headers({
            origin: "https://untrusted.example",
            cookie: "untrusted=value",
          }),
          new Headers({
            origin: "https://untrusted.example",
            "sec-fetch-site": "cross-site",
          }),
        ]) {
          const body = signup()
          const response = await invoke(request(path, body, extra))
          expect(response.status).toBe(403)
          expect(
            await connection.db
              .select({ id: user.id })
              .from(user)
              .where(eq(user.email, body.email)),
          ).toEqual([])
        }
      }
      const response = await auth.handler(
        request("/api/auth/sign-in/email", {
          ...signup(),
          callbackURL: "https://untrusted.example/callback",
        }),
      )
      expect(response.status).toBe(403)
      expect(log).toHaveBeenCalledWith("[Flowmark auth] Provider diagnostic", {
        level: "error",
      })
      expect(JSON.stringify(log.mock.calls)).not.toContain("untrusted.example")
      log.mockRestore()
    })

    it("shares the provider HTTP signup bucket across the alias and direct endpoint", async () => {
      const context = await auth.$context
      const previous = { ...context.rateLimit }
      Object.assign(context.rateLimit, {
        enabled: true,
        customRules: { "/sign-up/email": { window: 60, max: 2 } },
      })
      try {
        const responses = await Promise.all(
          Array.from({ length: 5 }, (_, i) => {
            const body = signup()
            return i % 2
              ? auth.handler(request("/api/auth/sign-up/email", body))
              : register(request("/api/register", body))
          }),
        )
        expect(
          responses.filter((response) => response.status === 200),
        ).toHaveLength(2)
        const denied = responses.filter((response) => response.status === 429)
        expect(denied).toHaveLength(3)
        for (const response of denied) {
          expect(Number(response.headers.get("x-retry-after"))).toBeGreaterThan(
            0,
          )
        }
      } finally {
        Object.assign(context.rateLimit, previous)
        context.rateLimit.customRules = previous.customRules
      }
    })

    it("denies expired and provider-revoked sessions for reads and management", async () => {
      for (const mode of ["expired", "revoked"]) {
        const body = signup()
        expect((await register(request("/api/register", body))).status).toBe(
          200,
        )
        const signedIn = await auth.handler(
          request("/api/auth/sign-in/email", body),
        )
        expect(signedIn.status).toBe(200)
        const cookie = cookieOf(signedIn)
        const token = (await signedIn.json()).token as string
        expect(await caller(cookie).project.list()).toEqual([])
        if (mode === "expired") {
          await connection.db
            .update(session)
            .set({ expiresAt: new Date(Date.now() - 1000) })
            .where(eq(session.token, token))
        } else {
          const revoked = await auth.handler(
            request("/api/auth/revoke-session", { token }, { cookie }),
          )
          expect(revoked.status).toBe(200)
        }
        await expect(caller(cookie).project.list()).rejects.toMatchObject({
          code: "UNAUTHORIZED",
        })
        await expect(
          caller(cookie).project.create({ name: "Denied project" }),
        ).rejects.toMatchObject({ code: "UNAUTHORIZED" })
      }
    })

    it("upgrades the legacy fixture only during an explicit guarded local seed, retaining its identity", async () => {
      const previousMode = process.env.FLOWMARK_DEMO_MODE
      const context = await auth.$context
      // These are synthetic rows in the disposable loopback test database.
      const legacy = await context.internalAdapter.createUser(
        {
          email: "local@dev",
          name: "Legacy test fixture",
          emailVerified: true,
        },
        { method: "email-password" },
      )
      const hash = await context.password.hash(LOCAL_DEV_PASSWORD)
      await context.internalAdapter.linkAccount({
        userId: legacy.id,
        providerId: "credential",
        accountId: legacy.id,
        password: hash,
      })
      await expect(
        auth.api.signInEmail({
          body: { email: "local@dev", password: LOCAL_DEV_PASSWORD },
        }),
      ).rejects.toMatchObject({ status: "BAD_REQUEST" })
      try {
        vi.stubEnv("FLOWMARK_DEMO_MODE", "false")
        await expect(
          Effect.runPromise(seedLocalAuthUser(process.env.TEST_DATABASE_URL!)),
        ).rejects.toThrow()
        vi.stubEnv("FLOWMARK_DEMO_MODE", "true")
        expect(
          await Effect.runPromise(
            seedLocalAuthUser(process.env.TEST_DATABASE_URL!),
          ),
        ).toBe(legacy.id)
        expect(
          await Effect.runPromise(
            seedLocalAuthUser(process.env.TEST_DATABASE_URL!),
          ),
        ).toBe(legacy.id)
        const renamed = await connection.db
          .select()
          .from(user)
          .where(eq(user.id, legacy.id))
        expect(renamed[0].email).toBe(LOCAL_DEV_EMAIL)
        const signedIn = await auth.handler(
          request("/api/auth/sign-in/email", {
            email: LOCAL_DEV_EMAIL,
            password: LOCAL_DEV_PASSWORD,
          }),
        )
        expect(signedIn.status).toBe(200)
        expect((await signedIn.json()).user.id).toBe(legacy.id)
        // An ambiguous pair is rejected without merging identities.
        const conflict = await context.internalAdapter.createUser(
          {
            email: "local@dev",
            name: "Conflicting test fixture",
            emailVerified: true,
          },
          { method: "email-password" },
        )
        await expect(
          Effect.runPromise(seedLocalAuthUser(process.env.TEST_DATABASE_URL!)),
        ).rejects.toThrow()
        await connection.db.delete(user).where(eq(user.id, conflict.id))
      } finally {
        vi.stubEnv("FLOWMARK_DEMO_MODE", previousMode)
        await connection.db.delete(user).where(eq(user.id, legacy.id))
      }
    })
  },
)
