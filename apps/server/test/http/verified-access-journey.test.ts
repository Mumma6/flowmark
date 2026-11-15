import { randomUUID } from "node:crypto"
import { Effect } from "effect"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { createDatabase } from "@flowmark/db"
import { createFlowmarkAuth } from "@flowmark/auth"
import { Email, makeEmailCapture } from "@flowmark/email"
import { createFlowmark } from "../../../../packages/sdk/src/index.js"
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
  },
)
