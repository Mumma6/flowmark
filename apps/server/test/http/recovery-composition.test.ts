import { randomUUID } from "node:crypto"
import { afterEach, describe, expect, it, vi } from "vitest"
import { POST } from "../../app/api/auth/[...all]/route"

const afterWork = vi.hoisted(() => [] as Array<() => Promise<void>>)
vi.mock("next/server", () => ({
  after: (work: () => Promise<void>) => afterWork.push(work),
}))
const origin = "http://localhost:3001"
const post = (path: string, body: unknown, cookie = "") =>
  POST(
    new Request(`${origin}/api/auth/${path}`, {
      method: "POST",
      headers: { origin, cookie, "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  )

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  afterWork.length = 0
})

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  "server recovery composition",
  () => {
    it("uses configured Resend in the real route and acknowledges requests before lifetime-managed delivery", async () => {
      vi.stubEnv("DATABASE_URL", process.env.TEST_DATABASE_URL!)
      vi.stubEnv("RESEND_API_KEY", "re_synthetic_only")
      vi.stubEnv("FLOWMARK_EMAIL_ENVIRONMENT", "local")
      vi.stubEnv("FLOWMARK_EMAIL_FROM", "accounts@example.test")
      vi.stubEnv("FLOWMARK_EMAIL_REPLY_TO", "help@example.test")
      vi.stubEnv("BETTER_AUTH_URL", origin)
      vi.stubEnv("FLOWMARK_DASHBOARD_ORIGIN", origin)
      const log = vi.spyOn(console, "error").mockImplementation(() => {})
      let resolveDelivery!: (response: Response) => void
      const bodies: Array<{
        subject: string
        html: string
        text: string
        to: string[]
        from: string
      }> = []
      vi.stubGlobal(
        "fetch",
        vi.fn<typeof fetch>().mockImplementation(async (url, options) => {
          expect(url).toBe("https://api.resend.com/emails")
          bodies.push(JSON.parse(String(options?.body)))
          return new Promise<Response>((resolve) => {
            resolveDelivery = resolve
          })
        }),
      )
      const email = `${randomUUID()}@example.test`
      const signup = await post("sign-up/email", {
        name: "Composition",
        email,
        password: randomUUID(),
      })
      expect(signup.status).toBe(200)
      const known = await post("request-password-reset", {
        email,
        redirectTo: `${origin}/reset-password`,
      })
      expect(known.status).toBe(200)
      expect(afterWork).toHaveLength(1)
      expect(bodies[0].to).toEqual([email])
      expect(bodies[0].subject).toMatch(/^\[Local\]/)
      // Failure is handled by the provider/task boundary, not exposed as an account oracle.
      resolveDelivery(
        Response.json(
          { message: "synthetic-private-provider-value" },
          { status: 503 },
        ),
      )
      await afterWork[0]()
      const unknown = await post("request-password-reset", {
        email: `${randomUUID()}@example.test`,
        redirectTo: `${origin}/reset-password`,
      })
      expect(unknown.status).toBe(known.status)
      expect(await known.json()).toEqual(await unknown.json())
      expect(afterWork).toHaveLength(1)
      const link = new URL(bodies[0].text.match(/Reset password: (\S+)/)![1])
      const token = link.pathname.split("/").at(-1)!
      const newPassword = randomUUID()
      const completed = await post("reset-password", { token, newPassword })
      expect(completed.status).toBe(200)
      expect(afterWork).toHaveLength(2)
      resolveDelivery(
        Response.json(
          { message: "synthetic-private-provider-value" },
          { status: 503 },
        ),
      )
      await afterWork[1]()
      expect(
        (await post("sign-in/email", { email, password: newPassword })).status,
      ).toBe(200)
      const loggedIn = await post("sign-in/email", {
        email,
        password: newPassword,
      })
      const cookie = loggedIn.headers
        .getSetCookie()
        .map((value) => value.split(";")[0])
        .join("; ")
      const confirmation = await post(
        "send-verification-email",
        { email, callbackURL: `${origin}/settings?section=account` },
        cookie,
      )
      expect(confirmation.status).toBe(200)
      expect(afterWork).toHaveLength(3)
      resolveDelivery(Response.json({}, { status: 503 }))
      await afterWork[2]()
      const anonymousKnown = await post("send-verification-email", {
        email,
        callbackURL: `${origin}/settings?section=account`,
      })
      expect(anonymousKnown.status).toBe(200)
      expect(afterWork).toHaveLength(4)
      resolveDelivery(Response.json({}, { status: 503 }))
      await afterWork[3]()
      const anonymousUnknown = await post("send-verification-email", {
        email: `${randomUUID()}@example.test`,
        callbackURL: `${origin}/settings?section=account`,
      })
      expect(anonymousUnknown.status).toBe(anonymousKnown.status)
      expect(await anonymousKnown.json()).toEqual(await anonymousUnknown.json())
      expect(afterWork).toHaveLength(4)
      expect(JSON.stringify(log.mock.calls)).not.toContain(email)
      expect(JSON.stringify(log.mock.calls)).not.toContain(
        "synthetic-private-provider-value",
      )
      expect(JSON.stringify(log.mock.calls)).not.toContain("re_synthetic_only")
      expect(log).toHaveBeenCalled()
    })
  },
)
