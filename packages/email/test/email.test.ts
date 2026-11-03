import assert from "node:assert/strict"
import test from "node:test"
import { Array, Effect, Result } from "effect"
import {
  Email,
  emailSettings,
  makeEmailCapture,
  renderEmail,
  resendLayer,
} from "../src/index.js"

const origin = "https://app.example.com"
const env = {
  RESEND_API_KEY: "re_synthetic_test_only",
  FLOWMARK_EMAIL_FROM: "accounts@example.com",
  FLOWMARK_EMAIL_REPLY_TO: "help@example.com",
  BETTER_AUTH_URL: origin,
  FLOWMARK_EMAIL_ENVIRONMENT: "production",
}
const message = {
  kind: "reset-password",
  to: "person@example.com",
  messageId: "12345678-1234-4234-8234-123456789abc",
  actionUrl: `${origin}/api/auth/reset-password?token=synthetic&callbackURL=%2Fsettings`,
  expiresInMinutes: 30,
}
const send = (input: unknown = message) =>
  Email.use((email) => email.send(input))
const failure = <A, E>(result: Result.Result<A, E>) =>
  Result.match(result, {
    onFailure: (error) => error,
    onSuccess: () => assert.fail("Expected a typed failure"),
  })

test("all allowlisted templates render accessible HTML, text and explicit expiry", async () => {
  await Effect.runPromise(
    Effect.forEach(
      ["verify-email", "reset-password", "change-email"] as const,
      (kind) =>
        renderEmail({ ...message, kind }, origin).pipe(
          Effect.tap((mail) =>
            Effect.sync(() => {
              assert.match(mail.html, /<html lang="en">/)
              assert.match(mail.html, /<h1\s/)
              assert.match(mail.html, /&amp;callbackURL/)
              assert.match(mail.text, /expires in 30 minutes/)
              assert.ok(mail.text.includes(message.actionUrl))
              assert.ok(!mail.idempotencyKey.includes("synthetic"))
            }),
          ),
        ),
    ),
  )
  await Effect.runPromise(
    Effect.forEach(["password-changed", "email-changed"] as const, (event) =>
      renderEmail({ ...message, kind: "security-notice", event }, origin).pipe(
        Effect.tap((mail) =>
          Effect.sync(() => {
            assert.match(mail.text, /If you did not make this change/)
            assert.ok(!mail.text.includes("token="))
          }),
        ),
      ),
    ),
  )
})

test("capture is caller-owned, deduplicates retries and can clear bearer links", async () => {
  await Effect.runPromise(
    Effect.gen(function* () {
      const capture = yield* makeEmailCapture(origin)
      const result = yield* send().pipe(Effect.provide(capture.layer))
      yield* send().pipe(Effect.provide(capture.layer))
      assert.equal(result.status, "submitted")
      assert.equal((yield* capture.read).length, 1)
      assert.equal((yield* capture.read)[0].to, message.to)
      const conflict = yield* send({
        ...message,
        to: "other@example.com",
      }).pipe(Effect.provide(capture.layer), Effect.result)
      assert.equal(failure(conflict).reason, "idempotency-conflict")
      assert.equal((yield* capture.read).length, 1)
      yield* capture.clear
      assert.deepEqual(yield* capture.read, [])
    }),
  )
})

test("all Staging templates are visibly labeled and cannot collide with Production messages", async () => {
  await Effect.runPromise(
    Effect.forEach(
      [
        "verify-email",
        "reset-password",
        "change-email",
        "security-notice",
        "delivery-test",
      ] as const,
      (kind) =>
        Effect.gen(function* () {
          const input = { ...message, kind, event: "password-changed" }
          const staging = yield* renderEmail(input, origin, "staging")
          const production = yield* renderEmail(input, origin, "production")
          assert.match(staging.subject, /^\[Staging\] /)
          assert.match(staging.text, /Staging environment/)
          assert.match(staging.html, /STAGING &middot;/)
          assert.ok(!production.subject.startsWith("["))
          assert.ok(!production.text.includes("Staging"))
          assert.ok(!production.html.includes("STAGING"))
          assert.notEqual(staging.idempotencyKey, production.idempotencyKey)
        }),
    ),
  )
})

test("live adapters require an explicit valid environment", async () => {
  const results = await Effect.runPromise(
    Effect.forEach([undefined, "unknown"], (FLOWMARK_EMAIL_ENVIRONMENT) =>
      emailSettings({ ...env, FLOWMARK_EMAIL_ENVIRONMENT }).pipe(Effect.result),
    ),
  )
  Array.forEach(results, (result) =>
    assert.equal(failure(result).operation, "configuration"),
  )
})

test("delivery checks never claim an account change or contain a recovery token", async () => {
  const mail = await Effect.runPromise(
    renderEmail({ ...message, kind: "delivery-test" }, origin, "staging"),
  )
  assert.equal(mail.subject, "[Staging] Flowmark email delivery test")
  assert.match(mail.text, /No account settings were changed/)
  assert.match(mail.text, /No action is required/)
  assert.ok(!mail.text.includes("token="))
  assert.ok(!mail.text.includes("password was changed"))
})

test("invalid input fails before network access and errors redact supplied secrets", async () => {
  let calls = 0
  const fetcher: typeof fetch = async () => {
    calls++
    throw new Error("Unexpected network")
  }
  const inputs = [
    { ...message, to: "victim@example.com\r\nBcc: other@example.com" },
    { ...message, to: [message.to] },
    { ...message, kind: "marketing" },
    { ...message, expiresInMinutes: 0 },
    { ...message, messageId: "token=synthetic" },
    { ...message, actionUrl: "https://evil.example/reset?token=synthetic" },
    { ...message, actionUrl: "https://user:synthetic@app.example.com/reset" },
    { ...message, actionUrl: "javascript:alert(1)" },
  ]
  const results = await Effect.runPromise(
    Effect.forEach(inputs, (input) =>
      send(input).pipe(
        Effect.provide(resendLayer(env, fetcher)),
        Effect.result,
      ),
    ),
  )
  Array.forEach(results, (result) => {
    const error = failure(result)
    assert.equal(error._tag, "EmailError")
    assert.ok(!JSON.stringify(error).includes("synthetic"))
  })
  assert.equal(calls, 0)
})

test("missing config and unsafe origins fail closed without exposing their inputs", async () => {
  const inputs = [
    {},
    { ...env, RESEND_API_KEY: "" },
    ...Array.map(
      [
        "http://public.example.com",
        "https://user:secret@app.example.com",
        "https://app.example.com/path",
        "javascript:alert(1)",
      ],
      (BETTER_AUTH_URL) => ({ ...env, BETTER_AUTH_URL }),
    ),
  ]
  await Effect.runPromise(
    Effect.forEach(inputs, (input) =>
      emailSettings(input).pipe(
        Effect.result,
        Effect.tap((result) =>
          Effect.sync(() => {
            const error = failure(result)
            assert.equal(error.operation, "configuration")
            assert.ok(!JSON.stringify(error).includes(env.RESEND_API_KEY))
          }),
        ),
      ),
    ),
  )
  await Effect.runPromise(
    emailSettings({ ...env, BETTER_AUTH_URL: "http://127.0.0.1:3000" }),
  )
})

test("Resend submits the complete message once per attempt with a stable opaque idempotency key", async () => {
  const attempts: RequestInit[] = []
  const fetcher: typeof fetch = async (url, init) => {
    assert.equal(url, "https://api.resend.com/emails")
    attempts.push(init!)
    return Response.json({ id: "fixture-submission" })
  }
  const layer = resendLayer(env, fetcher)
  const result = await Effect.runPromise(send().pipe(Effect.provide(layer)))
  await Effect.runPromise(send().pipe(Effect.provide(layer)))
  assert.deepEqual(result, {
    status: "submitted",
    providerId: "fixture-submission",
  })
  assert.equal(attempts.length, 2)
  assert.equal(attempts[0].body, attempts[1].body)
  const headers = new Headers(attempts[0].headers)
  assert.equal(headers.get("Authorization"), `Bearer ${env.RESEND_API_KEY}`)
  assert.equal(
    headers.get("Idempotency-Key"),
    `flowmark/production/reset-password/${message.messageId}`,
  )
  assert.equal(attempts[0].redirect, "error")
  assert.ok(attempts[0].signal?.aborted)
  const body = JSON.parse(String(attempts[0].body))
  assert.equal(body.from, "Flowmark <accounts@example.com>")
  assert.deepEqual(body.tags, [{ name: "environment", value: "production" }])
  assert.equal(body.reply_to, "help@example.com")
  assert.deepEqual(body.to, [message.to])
  assert.ok(body.text && body.html)
})

test("Staging submissions carry the environment in sender, subject and provider tag", async () => {
  const fetcher: typeof fetch = async (_url, init) => {
    const body = JSON.parse(String(init?.body))
    assert.equal(body.from, "Flowmark Staging <accounts@example.com>")
    assert.match(body.subject, /^\[Staging\] /)
    assert.deepEqual(body.tags, [{ name: "environment", value: "staging" }])
    return Response.json({ id: "fixture-staging" })
  }
  await Effect.runPromise(
    send().pipe(
      Effect.provide(
        resendLayer({ ...env, FLOWMARK_EMAIL_ENVIRONMENT: "staging" }, fetcher),
      ),
    ),
  )
})

test("rejections, network errors and malformed responses are typed and never automatically retried", async () => {
  const cases = [
    {
      expected: "rejected",
      run: () =>
        Promise.resolve(new Response("token=synthetic", { status: 429 })),
    },
    {
      expected: "network",
      run: () =>
        Promise.reject(new Error(message.actionUrl + env.RESEND_API_KEY)),
    },
    {
      expected: "invalid-response",
      run: () => Promise.resolve(Response.json({ error: message.actionUrl })),
    },
    {
      expected: "invalid-response",
      run: () => Promise.resolve(new Response("not-json")),
    },
  ]
  await Effect.runPromise(
    Effect.forEach(cases, ({ expected, run }) =>
      Effect.gen(function* () {
        let calls = 0
        const result = yield* send().pipe(
          Effect.provide(
            resendLayer(env, async () => {
              calls++
              return run()
            }),
          ),
          Effect.result,
        )
        const error = failure(result)
        assert.equal(error.reason, expected)
        assert.equal(calls, 1)
        assert.ok(!JSON.stringify(error).includes("synthetic"))
      }),
    ),
  )
})

test(
  "timeout aborts an ambiguous submission and does not retry",
  { timeout: 15000 },
  async () => {
    let signal: AbortSignal | undefined
    let calls = 0
    const fetcher: typeof fetch = async (_url, init) => {
      calls++
      signal = init!.signal!
      return new Promise<Response>((_resolve, reject) => {
        signal!.addEventListener("abort", () => reject(new Error("aborted")))
      })
    }
    const result = await Effect.runPromise(
      send().pipe(Effect.provide(resendLayer(env, fetcher)), Effect.result),
    )
    assert.equal(failure(result).reason, "timeout")
    assert.equal(signal?.aborted, true)
    assert.equal(calls, 1)
  },
)

test("caller interruption aborts an outstanding submission", async () => {
  let signal: AbortSignal | undefined
  const fetcher: typeof fetch = async (_url, init) => {
    signal = init!.signal!
    return new Promise<Response>((_resolve, reject) => {
      signal!.addEventListener("abort", () => reject(new Error("aborted")))
    })
  }
  const result = await Effect.runPromise(
    send().pipe(
      Effect.provide(resendLayer(env, fetcher)),
      Effect.timeout("30 millis"),
      Effect.result,
    ),
  )
  assert.equal(Result.isFailure(result), true)
  assert.equal(signal?.aborted, true)
})
