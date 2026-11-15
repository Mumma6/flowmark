import { randomUUID } from "node:crypto"
import { Effect } from "effect"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { createDatabase } from "@flowmark/db"
import { createFlowmarkAuth } from "@flowmark/auth"
import { Email, EmailError, makeEmailCapture } from "@flowmark/email"
import { createFlowmark } from "../../../../packages/sdk/src/index.js"
import { POST as register } from "../../app/api/register/route"
import { POST as ingest } from "../../app/v1/events/route"
import { getAuth, resetAuthCacheForTests } from "../../src/auth"
import { appRouter } from "../../src/adapters/trpc/router"

const origin = "http://localhost:3001"
const callbackURL = `${origin}/settings?section=account&emailVerification=complete`
const secret = `${randomUUID()}${randomUUID()}`

const cookieOf = (response: Response) =>
  response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .join("; ")

const post = (path: string, body: unknown, cookie = "") =>
  new Request(`${origin}/api/auth${path}`, {
    method: "POST",
    headers: { origin, cookie, "content-type": "application/json" },
    body: JSON.stringify(body),
  })

const caller = (cookie: string, projectId?: string) =>
  appRouter.createCaller({
    request: new Request(`${origin}/api/trpc`, {
      headers: {
        cookie,
        origin,
        ...(projectId ? { "x-flowmark-project-id": projectId } : {}),
      },
    }),
  })

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  "verified access through project evidence",
  () => {
    let connection: ReturnType<typeof createDatabase>

    beforeAll(() => {
      vi.stubEnv("DATABASE_URL", process.env.TEST_DATABASE_URL!)
      vi.stubEnv("FLOWMARK_DEMO_MODE", "false")
      vi.stubEnv("BETTER_AUTH_SECRET", secret)
      vi.stubEnv("BETTER_AUTH_URL", origin)
      vi.stubEnv("FLOWMARK_DASHBOARD_ORIGIN", origin)
      vi.stubEnv("VERCEL_ENV", "")
      resetAuthCacheForTests()
      connection = createDatabase(process.env.TEST_DATABASE_URL!)
    })

    afterAll(async () => {
      await connection?.close()
      vi.unstubAllEnvs()
      vi.unstubAllGlobals()
      resetAuthCacheForTests()
    })

    it("signs up, captures verification mail, then reads an SDK run with the same session", async () => {
      const capture = await Effect.runPromise(makeEmailCapture(origin, "local"))
      const delivery = await Effect.runPromise(
        Email.pipe(Effect.provide(capture.layer)),
      )
      const auth = createFlowmarkAuth({
        db: connection.db,
        secret,
        baseURL: origin,
        trustedOrigins: [origin],
        emailDelivery: delivery,
      })
      const password = `${randomUUID()}${randomUUID()}`
      const email = `${randomUUID()}@example.test`
      const signup = await auth.handler(
        post("/sign-up/email", {
          name: "Verified journey",
          email,
          password,
        }),
      )
      expect(signup.status).toBe(200)
      const cookie = cookieOf(signup)
      expect(cookie).toBeTruthy()
      expect((await Effect.runPromise(capture.read)).length).toBe(0)

      const requested = await auth.handler(
        post("/send-verification-email", { email, callbackURL }, cookie),
      )
      expect(requested.status).toBe(200)
      const [mail] = await Effect.runPromise(capture.read)
      expect(mail.to).toBe(email)
      expect(mail.text).not.toContain(password)
      const link = new URL(mail.text.match(/Verify email: (\S+)/)![1])
      expect(link.origin).toBe(origin)
      expect(link.searchParams.get("token")).toBeTruthy()

      const verified = await auth.handler(new Request(link))
      expect(verified.status).toBe(302)
      expect(verified.headers.get("location")).toBe(callbackURL)
      const session = await Effect.runPromise(getAuth()).then((serverAuth) =>
        serverAuth.api.getSession({
          headers: { cookie },
          query: { disableCookieCache: true },
        }),
      )
      expect(session?.user).toMatchObject({ email, emailVerified: true })

      const created = await caller(cookie).project.create({
        name: "Verified journey",
      })
      expect(created.writeKey.secret).toBeTruthy()
      vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) =>
        ingest(new Request(input, init)),
      )
      const client = createFlowmark({
        apiKey: created.writeKey.secret,
        apiUrl: "http://localhost",
      })
      const run = client.workflow("verified.access")
      run.done({ result: { checked: true } })
      await client.flush()

      const page = await caller(cookie, created.project.id).run.list({
        externalId: run.runId,
      })
      expect(page.total).toBe(1)
      expect(page.runs[0]?.externalId).toBe(run.runId)
    })

    const account = async () => {
      const capture = await Effect.runPromise(makeEmailCapture(origin, "local"))
      const captured = await Effect.runPromise(
        Email.pipe(Effect.provide(capture.layer)),
      )
      const auth = createFlowmarkAuth({
        db: connection.db,
        secret,
        baseURL: origin,
        trustedOrigins: [origin],
        emailDelivery: captured,
      })
      const email = `${randomUUID()}@example.test`
      const password = `${randomUUID()}${randomUUID()}`
      const signup = await auth.handler(
        post("/sign-up/email", { name: "Existing account", email, password }),
      )
      expect(signup.status).toBe(200)
      const cookie = cookieOf(signup)
      const userId = (await signup.json()).user.id as string
      return { auth, capture, email, password, cookie, userId }
    }
    const verifiedFlag = async (
      auth: ReturnType<typeof createFlowmarkAuth>,
      cookie: string,
    ) =>
      (
        await auth.handler(
          new Request(`${origin}/api/auth/get-session`, {
            headers: { cookie },
          }),
        )
      ).json()

    it("keeps unverified and duplicate accounts usable without granting recovery bypasses", async () => {
      const existing = await account()
      const signedIn = await existing.auth.handler(
        post("/sign-in/email", {
          email: existing.email,
          password: existing.password,
        }),
      )
      expect(signedIn.status).toBe(200)
      expect(
        (await verifiedFlag(existing.auth, existing.cookie)).user,
      ).toMatchObject({
        id: existing.userId,
        emailVerified: false,
      })
      const project = await caller(existing.cookie).project.create({
        name: "Unverified account",
      })
      expect(project.project.id).toBeTruthy()

      const duplicate = await existing.auth.handler(
        post("/sign-up/email", {
          name: "Duplicate",
          email: existing.email,
          password: `${randomUUID()}${randomUUID()}`,
        }),
      )
      expect(duplicate.status).toBeGreaterThanOrEqual(400)
      expect(duplicate.headers.getSetCookie()).toEqual([])
      const alias = await register(
        new Request(`${origin}/api/register`, {
          method: "POST",
          headers: { origin, "content-type": "application/json" },
          body: JSON.stringify({
            name: "Alias duplicate",
            email: existing.email,
            password: `${randomUUID()}${randomUUID()}`,
          }),
        }),
      )
      expect(alias.status).toBeGreaterThanOrEqual(400)
      expect(alias.headers.getSetCookie()).toEqual([])
      expect(await alias.json()).toEqual({
        error: "Could not create the account.",
      })
      const still = await existing.auth.handler(
        post("/sign-in/email", {
          email: existing.email,
          password: existing.password,
        }),
      )
      expect(still.status).toBe(200)
      expect(
        (await verifiedFlag(existing.auth, cookieOf(still))).user,
      ).toMatchObject({ id: existing.userId, emailVerified: false })

      const change = post("/change-email", {
        newEmail: `${randomUUID()}@example.test`,
      })
      change.headers.set("cookie", existing.cookie)
      expect((await existing.auth.handler(change)).status).toBe(403)
      const reset = await existing.auth.handler(
        post("/reset-password", {
          token: "not-a-mailbox-proof",
          newPassword: `${randomUUID()}${randomUUID()}`,
        }),
      )
      expect(reset.status).toBeGreaterThanOrEqual(400)
      expect(
        (
          await existing.auth.handler(
            post("/sign-in/email", {
              email: existing.email,
              password: existing.password,
            }),
          )
        ).status,
      ).toBe(200)
    })

    it("retries a rejected verification send and drops the pre-reset session", async () => {
      const capture = await Effect.runPromise(makeEmailCapture(origin, "local"))
      const captured = await Effect.runPromise(
        Email.pipe(Effect.provide(capture.layer)),
      )
      let rejected = false
      const delivery = Email.of({
        send: (input) =>
          Effect.gen(function* () {
            if (!rejected) {
              rejected = true
              return yield* new EmailError({
                operation: "submission",
                reason: "rejected",
              })
            }
            return yield* captured.send(input)
          }),
      })
      const auth = createFlowmarkAuth({
        db: connection.db,
        secret,
        baseURL: origin,
        trustedOrigins: [origin],
        emailDelivery: delivery,
      })
      const email = `${randomUUID()}@example.test`
      const password = `${randomUUID()}${randomUUID()}`
      const signup = await auth.handler(
        post("/sign-up/email", { name: "Retry", email, password }),
      )
      expect(signup.status).toBe(200)
      const cookie = cookieOf(signup)
      const failed = await auth.handler(
        post("/send-verification-email", { email, callbackURL }, cookie),
      )
      expect(failed.status).toBeGreaterThanOrEqual(400)
      expect(await Effect.runPromise(capture.read)).toHaveLength(0)
      expect((await verifiedFlag(auth, cookie)).user.emailVerified).toBe(false)
      const sent = await auth.handler(
        post("/send-verification-email", { email, callbackURL }, cookie),
      )
      expect(sent.status).toBe(200)
      const [mail] = await Effect.runPromise(capture.read)
      const link = new URL(mail.text.match(/Verify email: (\S+)/)![1])
      expect((await auth.handler(new Request(link))).status).toBe(302)
      expect((await verifiedFlag(auth, cookie)).user.emailVerified).toBe(true)

      const requested = await auth.handler(
        post("/request-password-reset", {
          email,
          redirectTo: `${origin}/reset-password`,
        }),
      )
      expect(requested.status).toBe(200)
      const resetMail = (await Effect.runPromise(capture.read)).find((item) =>
        item.subject.includes("Reset your"),
      )
      const token = new URL(
        resetMail!.text.match(/Reset password: (\S+)/)![1],
      ).pathname
        .split("/")
        .at(-1)!
      const nextPassword = `${randomUUID()}${randomUUID()}`
      expect(
        (
          await auth.handler(
            post("/reset-password", { token, newPassword: nextPassword }),
          )
        ).status,
      ).toBe(200)
      expect(
        (
          await auth.handler(
            new Request(`${origin}/api/auth/get-session`, {
              headers: { cookie },
            }),
          )
        ).status,
      ).toBe(200)
      await expect(
        caller(cookie).project.create({ name: "Old session" }),
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" })
      expect(
        (await auth.handler(post("/sign-in/email", { email, password })))
          .status,
      ).toBe(401)
      const replaced = await auth.handler(
        post("/sign-in/email", { email, password: nextPassword }),
      )
      expect(replaced.status).toBe(200)
      expect(
        (await verifiedFlag(auth, cookieOf(replaced))).user.emailVerified,
      ).toBe(true)
    })
  },
)
