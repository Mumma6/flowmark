import { randomUUID } from "node:crypto"
import { Effect } from "effect"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { createDatabase } from "@flowmark/db"
import { createFlowmarkAuth } from "@flowmark/auth"
import { Email, makeEmailCapture } from "@flowmark/email"

const origin = "http://localhost:3001"
const callbackURL = `${origin}/settings?section=account&emailVerification=complete`
const post = (path: string, body: unknown, cookie = "") =>
  new Request(`${origin}/api/auth${path}`, {
    method: "POST",
    headers: { origin, cookie, "content-type": "application/json" },
    body: JSON.stringify(body),
  })
const cookieOf = (response: Response) =>
  response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .join("; ")

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  "optional account email verification",
  () => {
    let connection: ReturnType<typeof createDatabase>
    beforeAll(() => {
      connection = createDatabase(process.env.TEST_DATABASE_URL!)
    })
    afterAll(async () => {
      await connection?.close()
    })
    const signup = async (auth: ReturnType<typeof createFlowmarkAuth>) => {
      const credentials = {
        name: "Verification test",
        email: `${randomUUID()}@example.test`,
        password: randomUUID(),
      }
      const response = await auth.handler(post("/sign-up/email", credentials))
      expect(response.status).toBe(200)
      const body = await response.json()
      return {
        credentials,
        id: body.user.id as string,
        cookie: cookieOf(response),
      }
    }
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
      return { auth, capture, owner: await signup(auth) }
    }
    const send = async (f: Awaited<ReturnType<typeof fixture>>, extra = {}) => {
      const response = await f.auth.handler(
        post(
          "/send-verification-email",
          { email: f.owner.credentials.email, callbackURL, ...extra },
          f.owner.cookie,
        ),
      )
      expect(response.status).toBe(200)
      const [mail] = await Effect.runPromise(f.capture.read)
      expect(mail.to).toBe(f.owner.credentials.email)
      expect(mail.text).toContain("expires in 30 minutes")
      return new URL(mail.text.match(/Verify email: (\S+)/)![1])
    }
    const session = async (
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

    it("keeps access optional and confirms the real account through the provider link", async () => {
      const f = await fixture()
      expect((await session(f.auth, f.owner.cookie)).user.emailVerified).toBe(
        false,
      )
      expect(
        (await f.auth.handler(post("/sign-in/email", f.owner.credentials)))
          .status,
      ).toBe(200)
      const link = await send(f)
      const response = await f.auth.handler(new Request(link))
      expect(response.status).toBe(302)
      expect(response.headers.get("location")).toBe(callbackURL)
      expect(response.headers.has("set-cookie")).toBe(false)
      expect((await session(f.auth, f.owner.cookie)).user).toMatchObject({
        id: f.owner.id,
        email: f.owner.credentials.email,
        emailVerified: true,
      })
      // Provider verification links are idempotent until expiry; they never sign in.
      const replay = await f.auth.handler(new Request(link))
      expect(replay.status).toBe(302)
      expect(replay.headers.has("set-cookie")).toBe(false)
    })
    it("never switches an existing different-account session when a link is opened", async () => {
      const f = await fixture()
      const other = await signup(f.auth)
      const link = await send(f)
      expect(
        (
          await f.auth.handler(
            new Request(link, { headers: { cookie: other.cookie } }),
          )
        ).status,
      ).toBe(302)
      expect((await session(f.auth, other.cookie)).user).toMatchObject({
        id: other.id,
        emailVerified: false,
      })
      expect((await session(f.auth, f.owner.cookie)).user).toMatchObject({
        id: f.owner.id,
        emailVerified: true,
      })
    })
    it("rejects mismatched recipients and untrusted callbacks without capturing mail", async () => {
      const f = await fixture()
      const mismatch = await f.auth.handler(
        post(
          "/send-verification-email",
          { email: `${randomUUID()}@example.test`, callbackURL },
          f.owner.cookie,
        ),
      )
      expect(mismatch.status).toBe(400)
      const untrusted = await f.auth.handler(
        post(
          "/send-verification-email",
          {
            email: f.owner.credentials.email,
            callbackURL: "https://untrusted.example/collect",
          },
          f.owner.cookie,
        ),
      )
      expect(untrusted.status).toBe(403)
      expect(await Effect.runPromise(f.capture.read)).toHaveLength(0)
    })
    it("routes tampered and expired links to safe feedback without verifying the address", async () => {
      const f = await fixture()
      const link = await send(f)
      link.searchParams.set(
        "token",
        `${link.searchParams.get("token")}tampered`,
      )
      const tampered = await f.auth.handler(new Request(link))
      expect(tampered.status).toBe(302)
      expect(
        new URL(tampered.headers.get("location")!).searchParams.get("error"),
      ).toBe("INVALID_TOKEN")
      const expired = await fixture()
      const context = await expired.auth.$context
      Object.assign(context.options.emailVerification!, { expiresIn: -1 })
      const expiredLink = await send(expired)
      const response = await expired.auth.handler(new Request(expiredLink))
      expect(response.status).toBe(302)
      expect(
        new URL(response.headers.get("location")!).searchParams.get("error"),
      ).toBe("TOKEN_EXPIRED")
      expect((await session(f.auth, f.owner.cookie)).user.emailVerified).toBe(
        false,
      )
      expect(
        (await session(expired.auth, expired.owner.cookie)).user.emailVerified,
      ).toBe(false)
    })
    it("enforces the durable per-address resend budget", async () => {
      const f = await fixture()
      const responses = await Promise.all(
        [1, 2, 3, 4].map(() =>
          f.auth.handler(
            post(
              "/send-verification-email",
              { email: f.owner.credentials.email, callbackURL },
              f.owner.cookie,
            ),
          ),
        ),
      )
      expect(responses.map((response) => response.status).sort()).toEqual([
        200, 200, 200, 429,
      ])
      expect(
        responses
          .find((response) => response.status === 429)
          ?.headers.get("retry-after"),
      ).toBeTruthy()
      expect(await Effect.runPromise(f.capture.read)).toHaveLength(3)
    })
  },
)
