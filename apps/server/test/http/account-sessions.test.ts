import { randomUUID } from "node:crypto"
import { eq } from "drizzle-orm"
import { Array, Effect } from "effect"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { createDatabase, user, session } from "@flowmark/db"
import { getAuth } from "../../src/auth"
import { appRouter } from "../../src/adapters/trpc/router"
import { createDefinitionImportFixture } from "./support/definition-import-fixture"

const origin = "http://localhost:3001"
describe.skipIf(!process.env.TEST_DATABASE_URL)(
  "account session management",
  () => {
    let connection: ReturnType<typeof createDatabase>
    const run = <A, E>(effect: Effect.Effect<A, E>) => Effect.runPromise(effect)
    const fixture = () =>
      run(
        Effect.gen(function* () {
          const value = yield* createDefinitionImportFixture(connection.db)
          const provider = yield* getAuth()
          const current = yield* Effect.promise(() =>
            provider.api.getSession({
              headers: { cookie: value.cookie },
              query: { disableCookieCache: true },
            }),
          )
          if (!current) {
            throw new Error("Missing synthetic session")
          }
          return { ...value, currentSessionId: current.session.id }
        }),
      )
    type Fixture = Awaited<ReturnType<typeof fixture>>
    const caller = (
      cookie: string,
      source = origin,
      extra: Record<string, string> = {},
    ) =>
      appRouter.createCaller({
        request: new Request(`${origin}/api/trpc`, {
          headers: { cookie, origin: source, ...extra },
        }),
      })
    const auth = () => run(getAuth())
    const signIn = async (value: Fixture) => {
      const [identity] = await connection.db
        .select()
        .from(user)
        .where(eq(user.id, value.userId))
      const response = await (
        await auth()
      ).handler(
        new Request(`${origin}/api/auth/sign-in/email`, {
          method: "POST",
          headers: {
            origin,
            "content-type": "application/json",
            "user-agent": "Mozilla/5.0 (Linux) Firefox/140.0",
          },
          body: JSON.stringify({
            email: identity.email,
            password: value.password,
          }),
        }),
      )
      expect(response.status).toBe(200)
      const cookie = response.headers
        .getSetCookie()
        .map((value) => value.split(";")[0])
        .join("; ")
      const identitySession = await (
        await auth()
      ).api.getSession({
        headers: { cookie },
        query: { disableCookieCache: true },
      })
      expect(identitySession).not.toBeNull()
      return {
        cookie,
        id: identitySession!.session.id,
        token: identitySession!.session.token,
      }
    }
    beforeAll(() => {
      vi.stubEnv("DATABASE_URL", process.env.TEST_DATABASE_URL!)
      vi.stubEnv("FLOWMARK_DEMO_MODE", "false")
      vi.stubEnv("BETTER_AUTH_SECRET", `account-session-tests-${randomUUID()}`)
      connection = createDatabase(process.env.TEST_DATABASE_URL!)
    })
    afterAll(async () => {
      await connection.close()
      vi.unstubAllEnvs()
    })

    it("returns token-free summaries and revokes exactly one owned session", async () => {
      const value = await fixture()
      const other = await signIn(value)
      const retained = await signIn(value)
      const foreign = await fixture()
      const rows = (await caller(value.cookie).accountSessions.list()).sessions
      expect(rows.filter((row) => row.current)).toHaveLength(1)
      expect(rows.find((row) => row.id === other.id)?.device).toBe(
        "Firefox on Linux",
      )
      expect(
        rows.every(
          (row) =>
            Object.keys(row).sort().join() ===
            ["id", "current", "device", "createdAt", "updatedAt", "expiresAt"]
              .sort()
              .join(),
        ),
      ).toBe(true)
      expect(JSON.stringify(rows)).not.toContain(other.token)
      expect(
        await caller(value.cookie).accountSessions.revoke({
          currentSessionId: value.currentSessionId,
          target: { kind: "single", sessionId: other.id },
          password: value.password,
        }),
      ).toEqual({ revoked: true })
      expect(
        await (
          await auth()
        ).api.getSession({
          headers: { cookie: other.cookie },
          query: { disableCookieCache: true },
        }),
      ).toBeNull()
      await expect(caller(other.cookie).project.list()).rejects.toThrow()
      expect(
        await (
          await auth()
        ).api.getSession({
          headers: { cookie: retained.cookie },
          query: { disableCookieCache: true },
        }),
      ).not.toBeNull()
      expect(await caller(foreign.cookie).project.list()).toHaveLength(1)
    }, 15000)

    it("rejects foreign, current, mixed-credential and untrusted-origin revocation", async () => {
      const value = await fixture()
      const foreign = await fixture()
      const [foreignSession] = await connection.db
        .select()
        .from(session)
        .where(eq(session.userId, foreign.userId))
      const current = (
        await caller(value.cookie).accountSessions.list()
      ).sessions.find((row) => row.current)!
      await expect(
        caller(
          value.cookie,
          "https://untrusted.example",
        ).accountSessions.revoke({
          currentSessionId: value.currentSessionId,
          target: { kind: "others" },
          password: value.password,
        }),
      ).rejects.toThrow("trusted Studio origin")
      await expect(
        caller(value.cookie, origin, {
          authorization: "Bearer synthetic-read-key",
        }).accountSessions.list(),
      ).rejects.toThrow("browser session")
      await expect(
        caller(value.cookie).accountSessions.revoke({
          currentSessionId: value.currentSessionId,
          target: { kind: "single", sessionId: foreignSession.id },
          password: value.password,
        }),
      ).rejects.toThrow("no longer available")
      await expect(
        caller(value.cookie).accountSessions.revoke({
          currentSessionId: value.currentSessionId,
          target: { kind: "single", sessionId: current.id },
          password: value.password,
        }),
      ).rejects.toThrow("this device")
      expect(await caller(value.cookie).project.list()).toHaveLength(1)
      await expect(
        caller(foreign.cookie).accountSessions.revoke({
          currentSessionId: value.currentSessionId,
          target: { kind: "others" },
          password: foreign.password,
        }),
      ).rejects.toThrow("sign-in changed")
      expect(await caller(foreign.cookie).project.list()).toHaveLength(1)
      await expect(caller("").accountSessions.list()).rejects.toThrow(
        "Sign in again",
      )
    }, 15000)

    it("reauthenticates bulk revocation and preserves the current and foreign sessions", async () => {
      const value = await fixture()
      const other = await signIn(value)
      const more = await signIn(value)
      const foreign = await fixture()
      await expect(
        caller(value.cookie).accountSessions.revoke({
          currentSessionId: value.currentSessionId,
          target: { kind: "others" },
          password: "synthetic-wrong-password",
        }),
      ).rejects.toThrow("password was not accepted")
      expect(await caller(other.cookie).project.list()).toHaveLength(1)
      await caller(value.cookie).accountSessions.revoke({
        currentSessionId: value.currentSessionId,
        target: { kind: "others" },
        password: value.password,
      })
      await expect(caller(other.cookie).project.list()).rejects.toThrow()
      await expect(caller(more.cookie).project.list()).rejects.toThrow()
      expect(await caller(value.cookie).project.list()).toHaveLength(1)
      expect(await caller(foreign.cookie).project.list()).toHaveLength(1)
      expect(
        (await caller(value.cookie).accountSessions.list()).sessions,
      ).toHaveLength(1)
    }, 15000)

    it("shares the password-attempt budget across requests and blocks raw token-bearing HTTP routes", async () => {
      const value = await fixture()
      await Effect.runPromise(
        Effect.forEach(
          Array.range(1, 5),
          () =>
            Effect.promise(() =>
              expect(
                caller(value.cookie).accountSessions.revoke({
                  currentSessionId: value.currentSessionId,
                  target: { kind: "others" },
                  password: "wrong-synthetic-password",
                }),
              ).rejects.toThrow("password was not accepted"),
            ),
          { discard: true },
        ),
      )
      await expect(
        caller(value.cookie).accountSessions.revoke({
          currentSessionId: value.currentSessionId,
          target: { kind: "others" },
          password: value.password,
        }),
      ).rejects.toThrow("Too many verification attempts")
      await Effect.runPromise(
        Effect.forEach(
          [
            "list-sessions",
            "revoke-session",
            "revoke-other-sessions",
            "revoke-sessions",
          ],
          (path) =>
            Effect.promise(async () => {
              const response = await (
                await auth()
              ).handler(
                new Request(`${origin}/api/auth/${path}`, {
                  method: path === "list-sessions" ? "GET" : "POST",
                  headers: {
                    origin,
                    cookie: value.cookie,
                    "content-type": "application/json",
                  },
                  ...(path === "list-sessions"
                    ? {}
                    : { body: JSON.stringify({ token: "synthetic" }) }),
                }),
              )
              expect(response.status).toBe(403)
              expect(response.headers.get("cache-control")).toBe("no-store")
              expect(await response.text()).not.toContain("synthetic")
            }),
          { discard: true },
        ),
      )
    }, 15000)

    it("keeps provider sign-out available and rejects an expired session", async () => {
      const value = await fixture()
      const response = await (
        await auth()
      ).handler(
        new Request(`${origin}/api/auth/sign-out`, {
          method: "POST",
          headers: {
            origin,
            cookie: value.cookie,
            "content-type": "application/json",
          },
          body: "{}",
        }),
      )
      expect(response.status).toBe(200)
      expect(response.headers.getSetCookie().length).toBeGreaterThan(0)
      await expect(caller(value.cookie).accountSessions.list()).rejects.toThrow(
        "Sign in again",
      )
      const stale = await fixture()
      await connection.db
        .update(session)
        .set({ createdAt: new Date(Date.now() - 2 * 86400_000) })
        .where(eq(session.userId, stale.userId))
      expect(await caller(stale.cookie).project.list()).toHaveLength(1)
      await expect(caller(stale.cookie).accountSessions.list()).rejects.toThrow(
        "Sign in again",
      )
      const signOutStale = await (
        await auth()
      ).handler(
        new Request(`${origin}/api/auth/sign-out`, {
          method: "POST",
          headers: {
            origin,
            cookie: stale.cookie,
            "content-type": "application/json",
          },
          body: "{}",
        }),
      )
      expect(signOutStale.status).toBe(200)
      await expect(caller(stale.cookie).project.list()).rejects.toThrow()
      const expired = await fixture()
      await connection.db
        .update(session)
        .set({ expiresAt: new Date(0) })
        .where(eq(session.userId, expired.userId))
      await expect(
        caller(expired.cookie).accountSessions.list(),
      ).rejects.toThrow("Sign in again")
    }, 15000)

    it("honors the account deletion fence before revealing or revoking sessions", async () => {
      const value = await fixture()
      await signIn(value)
      const preview = await caller(value.cookie).accountLifecycle.preview()
      await caller(value.cookie).accountLifecycle.confirm({
        operationId: preview.operation.id,
        confirmation: "DELETE MY ACCOUNT",
        password: value.password,
      })
      await expect(caller(value.cookie).accountSessions.list()).rejects.toThrow(
        "Sign in again",
      )
      await expect(
        caller(value.cookie).accountSessions.revoke({
          currentSessionId: value.currentSessionId,
          target: { kind: "others" },
          password: value.password,
        }),
      ).rejects.toThrow("Sign in again")
    }, 15000)
  },
)
