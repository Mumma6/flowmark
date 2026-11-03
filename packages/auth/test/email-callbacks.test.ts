import assert from "node:assert/strict"
import test from "node:test"
import { Effect } from "effect"
import { Email, EmailError, makeEmailCapture } from "@flowmark/email"
import { createAuthEmailCallbacks } from "../src/email-callbacks.js"
import { createFlowmarkAuth } from "../src/create-auth.js"

const origin = "https://app.example.test"
const user = {
  id: "synthetic-user",
  email: "person@example.test",
  name: "Test person",
  emailVerified: false,
  createdAt: new Date(),
  updatedAt: new Date(),
}
const captured = () =>
  Effect.runPromise(
    Effect.gen(function* () {
      const capture = yield* makeEmailCapture(origin, "staging")
      const delivery = yield* Email.pipe(Effect.provide(capture.layer))
      return { capture, callbacks: createAuthEmailCallbacks(delivery) }
    }),
  )

test("provider callbacks preserve generated URLs and use matching token lifetimes", async () => {
  const { capture, callbacks } = await captured()
  const verificationUrl = `${origin}/api/auth/verify-email?token=synthetic&callbackURL=%2Fsign-in`
  const resetUrl = `${origin}/api/auth/reset-password/synthetic?callbackURL=%2Freset-password`
  await callbacks.emailVerification.sendVerificationEmail({
    user,
    url: verificationUrl,
    token: "synthetic",
  })
  await callbacks.emailAndPassword.sendResetPassword({
    user,
    url: resetUrl,
    token: "synthetic",
  })
  const messages = await Effect.runPromise(capture.read)
  assert.equal(messages.length, 2)
  assert.ok(messages.every((message) => message.to === user.email))
  assert.ok(messages[0].text.includes(verificationUrl))
  assert.ok(messages[1].text.includes(resetUrl))
  assert.match(messages[0].text, /expires in 30 minutes/)
  assert.match(messages[1].text, /expires in 30 minutes/)
  assert.equal(callbacks.emailVerification.expiresIn, 1800)
  assert.equal(callbacks.emailAndPassword.resetPasswordTokenExpiresIn, 1800)
  assert.ok(
    messages.every((message) => message.subject.startsWith("[Staging]")),
  )
  assert.notEqual(messages[0].idempotencyKey, messages[1].idempotencyKey)
  assert.ok(
    messages.every((message) => !message.idempotencyKey.includes(user.id)),
  )
  assert.ok(
    messages.every((message) => !message.idempotencyKey.includes("synthetic")),
  )
})

test("reset completion sends a security notice without a reset token or user id", async () => {
  const { capture, callbacks } = await captured()
  await callbacks.emailAndPassword.onPasswordReset({ user })
  const [message] = await Effect.runPromise(capture.read)
  assert.match(message.text, /Your Flowmark password was changed/)
  assert.ok(!message.text.includes("token="))
  assert.ok(!message.html.includes(user.id))
  assert.ok(message.text.includes(`${origin}/settings?section=account`))
})

test("callbacks await submission and preserve failures without retries", async () => {
  let attempts = 0
  const error = new EmailError({
    operation: "submission",
    reason: "rejected",
    status: 429,
  })
  const callbacks = createAuthEmailCallbacks({
    send: () =>
      Effect.sync(() => {
        attempts += 1
      }).pipe(Effect.andThen(Effect.fail(error))),
  })
  await assert.rejects(
    callbacks.emailAndPassword.sendResetPassword({
      user,
      url: `${origin}/api/auth/reset-password/synthetic`,
      token: "synthetic",
    }),
    { reason: "rejected", status: 429 },
  )
  assert.equal(attempts, 1)
})

test("untrusted provider URLs fail before capture", async () => {
  const { capture, callbacks } = await captured()
  await assert.rejects(
    callbacks.emailVerification.sendVerificationEmail({
      user,
      url: "https://untrusted.example/verify?token=synthetic",
      token: "synthetic",
    }),
    { reason: "untrusted-url" },
  )
  assert.equal((await Effect.runPromise(capture.read)).length, 0)
})

test("injection configures callbacks without changing today's sign-in policy", async () => {
  // Provider options are inspected without executing queries against this stub.
  const auth = createFlowmarkAuth({
    db: {} as Parameters<typeof createFlowmarkAuth>[0]["db"],
    secret: "synthetic-test-secret-at-least-thirty-two-characters",
    baseURL: origin,
    trustedOrigins: [origin],
    emailDelivery: {
      send: () =>
        Effect.succeed({ status: "submitted", providerId: "fixture" }),
    },
  })
  const context = await auth.$context
  assert.equal(context.options.emailVerification?.sendOnSignUp, false)
  assert.equal(context.options.emailVerification?.sendOnSignIn, false)
  assert.equal(
    context.options.emailVerification?.autoSignInAfterVerification,
    false,
  )
  assert.equal(
    context.options.emailAndPassword?.requireEmailVerification,
    false,
  )
  assert.equal(context.options.user?.changeEmail?.enabled, false)
  assert.deepEqual(context.options.verification?.storeIdentifier, {
    default: "plain",
    overrides: { "reset-password:": "hashed" },
  })
  assert.equal(context.options.emailAndPassword?.autoSignIn, true)
  assert.equal(
    context.options.emailAndPassword?.revokeSessionsOnPasswordReset,
    true,
  )
  assert.equal(
    typeof context.options.emailAndPassword?.sendResetPassword,
    "function",
  )
})

test("without injection no email endpoint is enabled by stored environment settings", async () => {
  const auth = createFlowmarkAuth({
    db: {} as Parameters<typeof createFlowmarkAuth>[0]["db"],
    secret: "synthetic-test-secret-at-least-thirty-two-characters",
    baseURL: origin,
  })
  const context = await auth.$context
  assert.equal(
    context.options.emailVerification?.sendVerificationEmail,
    undefined,
  )
  assert.equal(context.options.emailAndPassword?.sendResetPassword, undefined)
})
