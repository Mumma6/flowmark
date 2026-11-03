import { randomUUID } from "node:crypto"
import { Effect } from "effect"
import { eq } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { createDatabase, verification } from "@flowmark/db"
import { createFlowmarkAuth } from "@flowmark/auth"
import { Email, makeEmailCapture } from "@flowmark/email"

const origin = "http://localhost:3001"
const request = (path: string, body: unknown) =>
  new Request(`${origin}/api/auth${path}`, {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify(body),
  })
const cookieOf = (response: Response) =>
  response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .join("; ")

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  "optional verification and provider-owned password recovery",
  () => {
    let connection: ReturnType<typeof createDatabase>
    beforeAll(() => {
      connection = createDatabase(process.env.TEST_DATABASE_URL!)
    })
    afterAll(async () => {
      await connection?.close()
    })

    const fixture = async () => {
      const capture = await Effect.runPromise(makeEmailCapture(origin, "local"))
      const delivery = await Effect.runPromise(
        Email.pipe(Effect.provide(capture.layer)),
      )
      const auth = createFlowmarkAuth({
        db: connection.db,
        secret: `${randomUUID()}${randomUUID()}`,
        baseURL: origin,
        trustedOrigins: [origin],
        emailDelivery: delivery,
      })
      const credentials = {
        name: "Recovery test",
        email: `${randomUUID()}@example.test`,
        password: `${randomUUID()}${randomUUID()}`,
      }
      const signup = await auth.handler(request("/sign-up/email", credentials))
      expect(signup.status).toBe(200)
      const initial = await signup.json()
      expect(initial.user.emailVerified).toBe(false)
      expect((await Effect.runPromise(capture.read)).length).toBe(0)
      const cookie = cookieOf(signup)
      expect(cookie).toBeTruthy()
      return {
        capture,
        auth,
        credentials,
        cookie,
        userId: initial.user.id as string,
      }
    }
    const recovery = async (f: Awaited<ReturnType<typeof fixture>>) => {
      const response = await f.auth.handler(
        request("/request-password-reset", {
          email: f.credentials.email,
          redirectTo: `${origin}/reset-password`,
        }),
      )
      expect(response.status).toBe(200)
      const messages = await Effect.runPromise(f.capture.read)
      const reset = messages.find((message) =>
        message.subject.includes("Reset your"),
      )!
      const url = new URL(reset.text.match(/Reset password: (\S+)/)![1])
      const token = url.pathname.split("/").at(-1)!
      return { response, token }
    }
    const sessionOf = async (
      f: Awaited<ReturnType<typeof fixture>>,
      cookie = f.cookie,
    ) => {
      const response = await f.auth.handler(
        new Request(`${origin}/api/auth/get-session`, { headers: { cookie } }),
      )
      expect(response.status).toBe(200)
      return response.json()
    }

    it("allows unverified signup/sign-in and returns generic reset-request feedback", async () => {
      const f = await fixture()
      expect((await sessionOf(f)).user.id).toBe(f.userId)
      const login = await f.auth.handler(
        request("/sign-in/email", f.credentials),
      )
      expect(login.status).toBe(200)
      const known = await recovery(f)
      const unknown = await f.auth.handler(
        request("/request-password-reset", {
          email: `${randomUUID()}@example.test`,
          redirectTo: `${origin}/reset-password`,
        }),
      )
      expect(unknown.status).toBe(known.response.status)
      expect(await unknown.json()).toEqual(await known.response.json())
      expect((await Effect.runPromise(f.capture.read)).length).toBe(1)
      expect((await sessionOf(f)).user.id).toBe(f.userId)
      const rows = await connection.db.select().from(verification)
      expect(rows.some((row) => row.identifier.includes(known.token))).toBe(
        false,
      )
    })

    it("accepts one concurrent use, rejects replay, revokes sessions and preserves identity", async () => {
      const f = await fixture()
      const login = await f.auth.handler(
        request("/sign-in/email", f.credentials),
      )
      const otherCookie = cookieOf(login)
      const { token } = await recovery(f)
      const newPassword = `${randomUUID()}${randomUUID()}`
      const responses = await Promise.all(
        [1, 2].map(() =>
          f.auth.handler(request("/reset-password", { token, newPassword })),
        ),
      )
      expect(responses.map((response) => response.status).sort()).toEqual([
        200, 400,
      ])
      expect(
        (
          await f.auth.handler(
            request("/reset-password", { token, newPassword }),
          )
        ).status,
      ).toBe(400)
      expect(await sessionOf(f)).toBeNull()
      expect(await sessionOf(f, otherCookie)).toBeNull()
      expect(
        (await f.auth.handler(request("/sign-in/email", f.credentials))).status,
      ).toBe(401)
      const loginAfter = await f.auth.handler(
        request("/sign-in/email", { ...f.credentials, password: newPassword }),
      )
      expect(loginAfter.status).toBe(200)
      expect((await loginAfter.json()).user).toMatchObject({
        id: f.userId,
        email: f.credentials.email,
        emailVerified: false,
      })
      const notices = (await Effect.runPromise(f.capture.read)).filter(
        (message) => message.subject.includes("account was updated"),
      )
      expect(notices.length).toBe(1)
      expect(notices[0].text).not.toContain(token)
    })

    it("rolls back spent token and session revocation if the password write fails", async () => {
      const f = await fixture()
      const { token } = await recovery(f)
      const context = await f.auth.$context
      const failure = vi
        .spyOn(context.internalAdapter, "updatePassword")
        .mockRejectedValueOnce(new Error("synthetic write failure"))
      const newPassword = `${randomUUID()}${randomUUID()}`
      const response = await f.auth.handler(
        request("/reset-password", { token, newPassword }),
      )
      expect(response.status).toBe(503)
      failure.mockRestore()
      expect((await sessionOf(f)).user.id).toBe(f.userId)
      expect(
        (await f.auth.handler(request("/sign-in/email", f.credentials))).status,
      ).toBe(200)
      expect(
        (
          await f.auth.handler(
            request("/reset-password", { token, newPassword }),
          )
        ).status,
      ).toBe(200)
    })

    it("rejects tampered/expired tokens and email changes without altering the password", async () => {
      const f = await fixture()
      const { token } = await recovery(f)
      expect(
        (
          await f.auth.handler(
            request("/reset-password", {
              token: `${token}tampered`,
              newPassword: randomUUID(),
            }),
          )
        ).status,
      ).toBe(400)
      const context = await f.auth.$context
      const record = await context.internalAdapter.findVerificationValue(
        `reset-password:${token}`,
      )
      expect(record).toBeTruthy()
      await connection.db
        .update(verification)
        .set({ expiresAt: new Date(Date.now() - 60_000) })
        .where(eq(verification.id, record!.id))
      expect(
        (
          await f.auth.handler(
            request("/reset-password", { token, newPassword: randomUUID() }),
          )
        ).status,
      ).toBe(400)
      const change = request("/change-email", {
        newEmail: `${randomUUID()}@example.test`,
      })
      change.headers.set("cookie", f.cookie)
      expect((await f.auth.handler(change)).status).toBe(400)
      expect(
        (await f.auth.handler(request("/sign-in/email", f.credentials))).status,
      ).toBe(200)
    })
    it("requires the current password and signs out other sessions after password change", async () => {
      const f = await fixture()
      const login = await f.auth.handler(
        request("/sign-in/email", f.credentials),
      )
      const otherCookie = cookieOf(login)
      const newPassword = `${randomUUID()}${randomUUID()}`
      const change = (currentPassword: string) => {
        const call = request("/change-password", {
          currentPassword,
          newPassword,
          revokeOtherSessions: true,
        })
        call.headers.set("cookie", f.cookie)
        return f.auth.handler(call)
      }
      expect((await change("wrong-password")).status).toBe(400)
      expect((await sessionOf(f, otherCookie)).user.id).toBe(f.userId)
      const response = await change(f.credentials.password)
      expect(response.status).toBe(200)
      expect(await sessionOf(f, otherCookie)).toBeNull()
      expect((await sessionOf(f, cookieOf(response))).user.id).toBe(f.userId)
    })
  },
)
