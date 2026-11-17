import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { test } from "node:test"
import { eq, sql } from "drizzle-orm"
import { Array, Effect, Option } from "effect"
import { createDatabase } from "@flowmark/db"
import { registrationInvitations, user } from "@flowmark/db/schema"
import { Database, RegistrationInvitationStore } from "@flowmark/db/persistence"
import { assertTestDatabaseTarget } from "@flowmark/db/test-environment"
import { Email, EmailError, makeEmailCapture } from "@flowmark/email"
import { createFlowmarkAuth } from "../src/create-auth.js"
import { invite } from "../src/registration/invite.js"
import {
  hashInvitationToken,
  REGISTRATION_INVITE_HEADER,
} from "../src/registration/invitation-token.js"

test(
  "invite-only account creation, duplicate delivery, expiry and existing sign-in",
  { skip: !process.env.TEST_DATABASE_URL },
  async () => {
    await Effect.runPromise(assertTestDatabaseTarget())
    const connection = createDatabase(process.env.TEST_DATABASE_URL!)
    const origin = "http://localhost:3001"
    const capture = await Effect.runPromise(makeEmailCapture(origin))
    const email = `invite-${randomUUID()}@example.test`
    const other = `other-${randomUUID()}@example.test`
    const password = "test-password-for-invitation"
    const run = <A, E>(
      effect: Effect.Effect<A, E, RegistrationInvitationStore | Email>,
    ) =>
      Effect.runPromise(
        effect.pipe(
          Effect.provide(RegistrationInvitationStore.layer),
          Effect.provideService(Database, connection.db),
          Effect.provide(capture.layer),
        ),
      )
    const previous = process.env.VERCEL_ENV
    process.env.VERCEL_ENV = "production"
    const auth = createFlowmarkAuth({
      db: connection.db,
      secret: "synthetic-test-secret-at-least-thirty-two-characters",
      baseURL: origin,
    })
    if (previous === undefined) {
      delete process.env.VERCEL_ENV
    } else {
      process.env.VERCEL_ENV = previous
    }
    const signup = (address: string, token?: string) =>
      auth.handler(
        new Request(`${origin}/api/auth/sign-up/email`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            origin,
            ...(token ? { [REGISTRATION_INVITE_HEADER]: token } : {}),
          },
          body: JSON.stringify({
            name: "Invited user",
            email: address,
            password,
          }),
        }),
      )
    try {
      assert.equal((await signup(other)).status, 403)
      const results = await run(
        Effect.forEach(
          [email, email.toUpperCase()],
          (address) => invite(address, origin),
          { concurrency: 2 },
        ),
      )
      assert.equal(
        Array.filter(results, (result) => result === "invited").length,
        1,
      )
      assert.equal(
        Array.filter(
          results,
          (result) => result === "already-invited-or-registered",
        ).length,
        1,
      )
      const messages = await Effect.runPromise(capture.read)
      assert.equal(messages.length, 1)
      assert.equal(messages[0].to, email)
      const link = messages[0].text.match(/Create your account: (\S+)/)?.[1]
      assert.ok(link)
      const token = new URL(link).searchParams.get("invite")!
      assert.equal(new URL(link).pathname, "/sign-up")
      const [stored] = await connection.db
        .select()
        .from(registrationInvitations)
        .where(eq(registrationInvitations.email, email))
      assert.equal(stored.tokenHash, hashInvitationToken(token))
      assert.notEqual(stored.tokenHash, token)
      assert.equal((await signup(email)).status, 403)
      assert.equal((await signup(other, token)).status, 403)
      assert.equal((await signup(email, "A".repeat(43))).status, 403)
      // The provider's server API goes through the same account-creation hook.
      await assert.rejects(
        auth.api.signUpEmail({
          body: { name: "Bypass attempt", email: other, password },
        }),
      )
      await connection.db
        .update(registrationInvitations)
        .set({ expiresAt: sql`now() - interval '1 second'` })
        .where(eq(registrationInvitations.email, email))
      assert.equal((await signup(email, token)).status, 403)
      assert.equal(await run(invite(email.toUpperCase(), origin)), "invited")
      const renewed = (await Effect.runPromise(capture.read))[1].text.match(
        /Create your account: (\S+)/,
      )![1]
      const nextToken = new URL(renewed).searchParams.get("invite")!
      assert.notEqual(nextToken, token)
      assert.equal((await signup(email, token)).status, 403)
      assert.equal((await signup(email.toUpperCase(), nextToken)).status, 200)
      assert.equal(
        await run(invite(email, origin)),
        "already-invited-or-registered",
      )
      assert.ok(
        Option.isNone(
          await run(
            RegistrationInvitationStore.use((store) =>
              store.get(email, hashInvitationToken(nextToken)),
            ),
          ),
        ),
      )
      const [created] = await connection.db
        .select()
        .from(user)
        .where(eq(user.email, email))
      assert.equal(created.emailVerified, false)
      const signedIn = await auth.handler(
        new Request(`${origin}/api/auth/sign-in/email`, {
          method: "POST",
          headers: { "content-type": "application/json", origin },
          body: JSON.stringify({ email, password }),
        }),
      )
      assert.equal(signedIn.status, 200)
      assert.ok(signedIn.headers.getSetCookie().length)
    } finally {
      await connection.db
        .delete(registrationInvitations)
        .where(eq(registrationInvitations.email, email))
      await connection.db.delete(user).where(eq(user.email, email))
      await connection.close()
    }
  },
)

test("failed invitation delivery releases the reservation for an explicit retry", async () => {
  const hashes: string[] = []
  const removed: string[] = []
  const program = invite(
    " PERSON@example.test ",
    "https://app.example.test",
  ).pipe(
    Effect.provideService(
      RegistrationInvitationStore,
      RegistrationInvitationStore.of({
        create: (email, hash) =>
          Effect.sync(() => {
            assert.equal(email, "person@example.test")
            hashes.push(hash)
            return Option.some({ id: randomUUID() })
          }),
        get: () => Effect.succeed(Option.none()),
        remove: (_email, hash) =>
          Effect.sync(() => {
            removed.push(hash)
          }),
      }),
    ),
    Effect.provideService(Email, {
      send: () =>
        Effect.fail(
          new EmailError({ operation: "submission", reason: "network" }),
        ),
    }),
  )
  await assert.rejects(Effect.runPromise(program))
  assert.equal(hashes.length, 1)
  assert.deepEqual(removed, hashes)
})
