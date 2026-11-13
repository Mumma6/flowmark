import { randomUUID } from "node:crypto"
import { Effect, Ref, Schema } from "effect"
import { eq, sql } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import {
  createDatabase,
  user,
  verification,
  oauthClient,
  oauthRefreshToken,
  projects,
  projectMembers,
  projectApiKeys,
} from "@flowmark/db"
import { createOwnedProject, Database } from "@flowmark/db/persistence"
import { createFlowmarkAuth } from "@flowmark/auth"
import {
  Email,
  EmailError,
  EmailMessage,
  makeEmailCapture,
} from "@flowmark/email"

const origin = "http://localhost:3001"
const secret = `${randomUUID()}${randomUUID()}`
const cookieOf = (response: Response) =>
  response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .join("; ")
const post = (
  path: string,
  body: unknown,
  cookie = "",
  requestOrigin = origin,
) =>
  new Request(`${origin}/api/auth${path}`, {
    method: "POST",
    headers: {
      cookie,
      origin: requestOrigin,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  })

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  "coordinated account email changes",
  () => {
    let connection: ReturnType<typeof createDatabase>
    beforeAll(() => {
      connection = createDatabase(process.env.TEST_DATABASE_URL!)
    })
    afterAll(async () => {
      await connection?.close()
    })
    const fixture = async (verified = true) => {
      const capture = await Effect.runPromise(makeEmailCapture(origin, "local"))
      const captured = await Effect.runPromise(
        Email.pipe(Effect.provide(capture.layer)),
      )
      const failKind = await Effect.runPromise(Ref.make<string | null>(null))
      const delivery = Email.of({
        send: (input) =>
          Effect.gen(function* () {
            const message = yield* Schema.decodeUnknownEffect(EmailMessage)(
              input,
            ).pipe(
              Effect.mapError(
                () =>
                  new EmailError({
                    operation: "validation",
                    reason: "invalid-message",
                  }),
              ),
            )
            if (message.kind === (yield* Ref.get(failKind))) {
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
      const credentials = {
        name: "Email change test",
        email: `${randomUUID()}@example.test`,
        password: `${randomUUID()}${randomUUID()}`,
      }
      const signup = await auth.handler(post("/sign-up/email", credentials))
      expect(signup.status).toBe(200)
      const { user: profile } = await signup.json()
      if (verified) {
        await connection.db
          .update(user)
          .set({ emailVerified: true })
          .where(eq(user.id, profile.id))
      }
      const cookie = cookieOf(signup)
      const session = await (
        await auth.handler(
          new Request(`${origin}/api/auth/get-session`, {
            headers: { cookie },
          }),
        )
      ).json()
      const nextEmail = `${randomUUID()}@example.test`
      const status = async (sessionCookie = cookie) => {
        const response = await auth.handler(
          new Request(`${origin}/api/auth/email-change/status`, {
            headers: { cookie: sessionCookie },
          }),
        )
        return { response, body: await response.json() }
      }
      const request = (email = nextEmail, password = credentials.password) =>
        auth.handler(
          post(
            "/email-change/request",
            { currentSessionId: session.session.id, newEmail: email, password },
            cookie,
          ),
        )
      const proof = async (kind: "old" | "new") => {
        const messages = await Effect.runPromise(capture.read)
        const matches = messages.filter((message) =>
          kind === "old"
            ? message.text.includes("Approve email change:")
            : message.text.includes("Confirm email:"),
        )
        const message = matches.at(-1)
        expect(message, `captured ${kind} proof`).toBeDefined()
        return message!.text.match(
          /https?:\/\/[^\s]+\/api\/auth\/email-change\/verify\?[^\s]+/,
        )![0]
      }
      const follow = (url: string, sessionCookie = "") =>
        auth.handler(new Request(url, { headers: { cookie: sessionCookie } }))
      const result = async (response: Response) => {
        const receipt = cookieOf(response)
        const read = () =>
          auth.handler(
            new Request(`${origin}/api/auth/email-change/result`, {
              headers: { cookie: receipt },
            }),
          )
        const value = await (await read()).json()
        expect(await (await read()).json()).toEqual({ result: null })
        return value.result
      }
      const profileNow = async () =>
        (
          await connection.db.select().from(user).where(eq(user.id, profile.id))
        )[0]
      return {
        auth,
        capture,
        failKind,
        credentials,
        cookie,
        sessionId: session.session.id as string,
        userId: profile.id as string,
        nextEmail,
        request,
        status,
        proof,
        follow,
        result,
        profileNow,
      }
    }

    it("requires both proofs, preserves identity, invalidates recovery and every browser session", async () => {
      const f = await fixture()
      const owned = await Effect.runPromise(
        createOwnedProject(f.userId, {
          workspace: "Email test",
          project: "Email ownership",
        }).pipe(Effect.provideService(Database, connection.db)),
      )
      const beforeProject = await connection.db
        .select()
        .from(projects)
        .where(eq(projects.id, owned.projectId))
      const beforeMembers = await connection.db
        .select()
        .from(projectMembers)
        .where(eq(projectMembers.projectId, owned.projectId))
      const beforeKeys = await connection.db
        .select()
        .from(projectApiKeys)
        .where(eq(projectApiKeys.projectId, owned.projectId))
      const clientId = randomUUID()
      const refreshId = randomUUID()
      await connection.db.insert(oauthClient).values({
        id: randomUUID(),
        clientId,
        redirectUris: [`${origin}/callback`],
      })
      await connection.db.insert(oauthRefreshToken).values({
        id: refreshId,
        token: randomUUID(),
        clientId,
        userId: f.userId,
        authorizationCodeId: randomUUID(),
        scopes: ["flowmark:read"],
      })
      const otherLogin = await f.auth.handler(
        post("/sign-in/email", f.credentials),
      )
      const otherCookie = cookieOf(otherLogin)
      await f.auth.handler(
        post("/request-password-reset", {
          email: f.credentials.email,
          redirectTo: `${origin}/reset-password`,
        }),
      )
      expect((await f.request()).status).toBe(200)
      const old = await f.proof("old")
      expect((await f.profileNow()).email).toBe(f.credentials.email)
      const first = await f.follow(old)
      expect(first.status).toBe(303)
      expect(await f.result(first)).toBe("check-new")
      expect((await f.profileNow()).email).toBe(f.credentials.email)
      const next = await f.proof("new")
      const finals = await Promise.all([f.follow(next), f.follow(next)])
      expect(finals.every((response) => response.status === 303)).toBe(true)
      expect((await Promise.all(finals.map(f.result))).sort()).toEqual(
        ["complete", null].sort(),
      )
      expect(await f.profileNow()).toMatchObject({
        id: f.userId,
        email: f.nextEmail,
        emailVerified: true,
      })
      expect(
        await connection.db
          .select()
          .from(projects)
          .where(eq(projects.id, owned.projectId)),
      ).toEqual(beforeProject)
      expect(
        await connection.db
          .select()
          .from(projectMembers)
          .where(eq(projectMembers.projectId, owned.projectId)),
      ).toEqual(beforeMembers)
      expect(
        await connection.db
          .select()
          .from(projectApiKeys)
          .where(eq(projectApiKeys.projectId, owned.projectId)),
      ).toEqual(beforeKeys)
      const [refresh] = await connection.db
        .select()
        .from(oauthRefreshToken)
        .where(eq(oauthRefreshToken.id, refreshId))
      expect(refresh.revoked).not.toBeNull()
      expect((await f.status()).response.status).toBe(401)
      expect((await f.status(otherCookie)).response.status).toBe(401)
      expect(
        (await f.auth.handler(post("/sign-in/email", f.credentials))).status,
      ).toBe(401)
      const login = await f.auth.handler(
        post("/sign-in/email", { ...f.credentials, email: f.nextEmail }),
      )
      expect(login.status).toBe(200)
      expect((await login.json()).user.id).toBe(f.userId)
      const records = await connection.db
        .select()
        .from(verification)
        .where(eq(verification.value, f.userId))
      expect(records).toHaveLength(0)
      expect(await f.result(await f.follow(next))).toBeNull()
      const notice = (await Effect.runPromise(f.capture.read)).find((mail) =>
        mail.subject.includes("account was updated"),
      )
      expect(notice?.to).toBe(f.credentials.email)
    })

    it("blocks unverified accounts, wrong passwords, stale sessions, untrusted origins and mixed credentials", async () => {
      const unverified = await fixture(false)
      expect((await unverified.request()).status).toBe(400)
      const f = await fixture()
      expect((await f.request(f.nextEmail, "wrong password")).status).toBe(400)
      expect(
        (
          await f.auth.handler(
            post(
              "/email-change/request",
              {
                currentSessionId: "stale",
                newEmail: f.nextEmail,
                password: f.credentials.password,
              },
              f.cookie,
            ),
          )
        ).status,
      ).toBe(409)
      expect(
        (
          await f.auth.handler(
            post("/email-change/request", {}, f.cookie, "https://evil.example"),
          )
        ).status,
      ).toBe(403)
      const mixed = post("/email-change/request", {}, f.cookie)
      mixed.headers.set("authorization", "Bearer not-an-agent-grant")
      expect((await f.auth.handler(mixed)).status).toBe(401)
      expect(await Effect.runPromise(f.capture.read)).toHaveLength(0)
    })

    it("cancels and replaces outstanding proofs and rejects expiry and cross-account cancellation", async () => {
      const f = await fixture()
      expect((await f.request()).status).toBe(200)
      const old = await f.proof("old")
      const first = (await f.status()).body.active
      const foreign = await fixture()
      expect(
        (
          await foreign.auth.handler(
            post(
              "/email-change/cancel",
              { currentSessionId: foreign.sessionId, id: first.id },
              foreign.cookie,
            ),
          )
        ).status,
      ).toBe(409)
      expect(
        (
          await f.auth.handler(
            post(
              "/email-change/cancel",
              { currentSessionId: f.sessionId, id: first.id },
              f.cookie,
            ),
          )
        ).status,
      ).toBe(200)
      expect(await f.result(await f.follow(old))).toBeNull()
      expect((await f.request()).status).toBe(200)
      const replaced = await f.proof("old")
      expect((await f.request(`${randomUUID()}@example.test`)).status).toBe(200)
      expect(await f.result(await f.follow(replaced))).toBeNull()
      const latest = await f.proof("old")
      const active = (await f.status()).body.active
      await connection.db
        .update(verification)
        .set({ expiresAt: new Date(Date.now() - 1000) })
        .where(eq(verification.id, active.id))
      expect(await f.result(await f.follow(latest))).toBeNull()
      expect((await f.profileNow()).email).toBe(f.credentials.email)
    })

    it("blocks raw provider bypasses and foreign signed-in proofs; allows signed-out proofs once", async () => {
      const f = await fixture()
      await f.request()
      const old = await f.proof("old")
      const token = new URL(old).searchParams.get("token")!
      expect(
        (
          await f.auth.handler(
            post("/change-email", { newEmail: f.nextEmail }, f.cookie),
          )
        ).status,
      ).toBe(403)
      expect(
        (
          await f.auth.handler(
            new Request(`${origin}/api/auth/verify-email?token=${token}`),
          )
        ).status,
      ).toBe(403)
      await expect(
        f.auth.api.verifyEmail({ query: { token } }),
      ).rejects.toBeDefined()
      await expect(
        f.auth.api.changeEmail({
          headers: new Headers({ cookie: f.cookie }),
          body: { newEmail: f.nextEmail },
        }),
      ).rejects.toBeDefined()
      const foreign = await fixture()
      expect(await f.result(await f.follow(old, foreign.cookie))).toBeNull()
      const responses = await Promise.all([f.follow(old), f.follow(old)])
      expect((await Promise.all(responses.map(f.result))).sort()).toEqual(
        ["check-new", null].sort(),
      )
      expect((await f.profileNow()).email).toBe(f.credentials.email)
    })

    it("rolls back identity and session changes when completion persistence fails, then permits retry", async () => {
      const f = await fixture()
      await f.request()
      await f.follow(await f.proof("old"))
      const proof = await f.proof("new")
      const active = (await f.status()).body.active
      const constraint = `email_change_test_${randomUUID().replaceAll("-", "")}`
      // Both identifiers are generated UUIDs in this disposable database only.
      await connection.db.execute(
        sql.raw(
          `ALTER TABLE verification ADD CONSTRAINT "${constraint}" CHECK (CASE WHEN id = '${active.id}' THEN value::jsonb->>'step' <> 'completed' ELSE true END)`,
        ),
      )
      try {
        expect(await f.result(await f.follow(proof, f.cookie))).toBeNull()
        expect((await f.profileNow()).email).toBe(f.credentials.email)
        expect((await f.status()).response.status).toBe(200)
        expect((await f.status()).body.active.step).toBe("verify-new")
      } finally {
        await connection.db.execute(
          sql.raw(`ALTER TABLE verification DROP CONSTRAINT "${constraint}"`),
        )
      }
      expect(await f.result(await f.follow(proof, f.cookie))).toBe("complete")
    })

    it("hides duplicate addresses and rolls back a newly occupied address without consuming proof", async () => {
      const f = await fixture()
      const occupied = await fixture()
      expect((await f.request(occupied.credentials.email)).status).toBe(200)
      expect(await Effect.runPromise(f.capture.read)).toHaveLength(0)
      expect((await f.profileNow()).email).toBe(f.credentials.email)
      await f.request()
      await f.follow(await f.proof("old"))
      const proof = await f.proof("new")
      await connection.db
        .update(user)
        .set({ email: f.nextEmail })
        .where(eq(user.id, occupied.userId))
      expect(await f.result(await f.follow(proof))).toBeNull()
      expect((await f.profileNow()).email).toBe(f.credentials.email)
      expect((await f.status()).body.active.step).toBe("verify-new")
      await connection.db
        .update(user)
        .set({ email: occupied.credentials.email })
        .where(eq(user.id, occupied.userId))
      expect(await f.result(await f.follow(proof))).toBe("complete")
    })

    it("honors account deletion fences and never accepts URL success flags as a result", async () => {
      const f = await fixture()
      await f.request()
      const old = await f.proof("old")
      await connection.db
        .update(user)
        .set({ lifecycleOperationId: randomUUID() })
        .where(eq(user.id, f.userId))
      expect(await f.result(await f.follow(old))).toBeNull()
      expect((await f.request()).status).not.toBe(200)
      expect((await f.profileNow()).email).toBe(f.credentials.email)
      const result = await f.auth.handler(
        new Request(
          `${origin}/api/auth/email-change/result?success=true&result=complete`,
        ),
      )
      expect(await result.json()).toEqual({ result: null })
    })

    it("leaves the profile unchanged when new-address submission fails and permits replacement", async () => {
      const f = await fixture()
      await f.request()
      const old = await f.proof("old")
      await Effect.runPromise(Ref.set(f.failKind, "change-email"))
      expect(await f.result(await f.follow(old))).toBe("delivery-failed")
      expect((await f.profileNow()).email).toBe(f.credentials.email)
      expect((await f.status()).body.active).toMatchObject({
        step: "verify-new",
        delivery: "failed",
      })
      await Effect.runPromise(Ref.set(f.failKind, null))
      expect((await f.request()).status).toBe(200)
      expect(await f.result(await f.follow(old))).toBeNull()
    })

    it("persists password and request budgets across factory instances", async () => {
      const f = await fixture()
      for (let attempt = 0; attempt < 5; attempt++) {
        expect(
          (await f.request(f.nextEmail, "incorrect-password")).status,
        ).toBe(400)
      }
      const delivery = await Effect.runPromise(
        Email.pipe(Effect.provide(f.capture.layer)),
      )
      const another = createFlowmarkAuth({
        db: connection.db,
        secret,
        baseURL: origin,
        trustedOrigins: [origin],
        emailDelivery: delivery,
      })
      const blocked = await another.handler(
        post(
          "/email-change/request",
          {
            currentSessionId: f.sessionId,
            newEmail: f.nextEmail,
            password: f.credentials.password,
          },
          f.cookie,
        ),
      )
      expect(blocked.status).toBe(429)
      expect((await f.request()).status).toBe(429)
      const allowed = await fixture()
      for (let attempt = 0; attempt < 3; attempt++) {
        expect((await allowed.request()).status).toBe(200)
      }
      expect((await allowed.request()).status).toBe(429)
      expect((await allowed.profileNow()).email).toBe(allowed.credentials.email)
    })

    it("keeps delivery failures truthful and retries only the fixed previous-address notice", async () => {
      const f = await fixture()
      await Effect.runPromise(Ref.set(f.failKind, "confirm-email-change"))
      expect((await f.request()).status).toBe(503)
      expect((await f.profileNow()).email).toBe(f.credentials.email)
      expect((await f.status()).body.active.delivery).toBe("failed")
      await Effect.runPromise(Ref.set(f.failKind, null))
      await f.request()
      const old = await f.proof("old")
      await f.follow(old)
      const next = await f.proof("new")
      await Effect.runPromise(Ref.set(f.failKind, "security-notice"))
      expect(await f.result(await f.follow(next))).toBe(
        "complete-notice-failed",
      )
      expect((await f.profileNow()).email).toBe(f.nextEmail)
      const login = await f.auth.handler(
        post("/sign-in/email", { ...f.credentials, email: f.nextEmail }),
      )
      const cookie = cookieOf(login)
      const current = await f.status(cookie)
      expect(current.body.notices).toHaveLength(1)
      await Effect.runPromise(Ref.set(f.failKind, null))
      const retry = await f.auth.handler(
        post(
          "/email-change/retry-notice",
          {
            currentSessionId: current.body.currentSessionId,
            id: current.body.notices[0].id,
          },
          cookie,
        ),
      )
      expect(retry.status).toBe(200)
      expect((await f.status(cookie)).body.notices).toHaveLength(0)
      const notice = (await Effect.runPromise(f.capture.read)).at(-1)!
      expect(notice.to).toBe(f.credentials.email)
    })
  },
)
