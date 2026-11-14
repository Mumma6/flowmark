import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { test } from "node:test"
import { URL } from "node:url"
import { runInNewContext } from "node:vm"
import { Effect, Result } from "effect"
import * as environment from "@flowmark/db/environment"
import ts from "typescript"

const { AbortSignal, Response } = globalThis
const require = createRequire(import.meta.url)
const client = (fetch) => {
  const exports = {}
  runInNewContext(
    ts.transpileModule(
      readFileSync(
        new URL("../features/waitlist/join-waitlist.ts", import.meta.url),
        "utf8",
      ),
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
        },
      },
    ).outputText,
    { exports, require, fetch, AbortSignal },
  )
  return exports.submitWaitlist
}
test("waitlist browser boundary sends no credentials and requires an acknowledged success", async () => {
  let sent
  const submit = client(async (endpoint, options) => {
    sent = { endpoint, options }
    return Response.json({ ok: true })
  })
  assert.equal(
    (
      await Effect.runPromise(
        submit("https://app.example.test/api/waitlist", "person@example.test"),
      )
    ).ok,
    true,
  )
  assert.equal(sent.options.credentials, "omit")
  assert.equal(sent.options.method, "POST")
  assert.equal(
    sent.options.body,
    JSON.stringify({ email: "person@example.test" }),
  )
})
test("waitlist browser boundary preserves rate limits, network errors and malformed acknowledgements as failures", async () => {
  const rateLimited = client(async () => Response.json({}, { status: 429 }))
  const failed = await Effect.runPromise(
    Effect.result(rateLimited("/api/waitlist", "person@example.test")),
  )
  assert.ok(Result.isFailure(failed))
  assert.match(failed.failure.message, /Too many requests/)
  const malformed = client(async () => Response.json({}))
  assert.ok(
    Result.isFailure(
      await Effect.runPromise(
        Effect.result(malformed("/api/waitlist", "person@example.test")),
      ),
    ),
  )
  const unavailable = client(async () => {
    throw new Error("private diagnostic")
  })
  const result = await Effect.runPromise(
    Effect.result(unavailable("/api/waitlist", "person@example.test")),
  )
  assert.ok(Result.isFailure(result))
  assert.ok(!result.failure.message.includes("private"))
})

const endpointFor = (appUrl, env) => {
  const exports = {}
  runInNewContext(
    ts.transpileModule(
      readFileSync(
        new URL("../features/waitlist/endpoint.ts", import.meta.url),
        "utf8",
      ),
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
        },
      },
    ).outputText,
    {
      exports,
      URL,
      require: (name) =>
        name.includes("site-links") ? { appUrl } : environment,
    },
  )
  return exports.waitlistEndpoint(env)
}
test("waitlist writes stay within the deployment environment", () => {
  assert.equal(
    endpointFor("https://app.flowmark.dev", { VERCEL_ENV: "production" }),
    "https://app.flowmark.dev/api/waitlist",
  )
  assert.equal(
    endpointFor("http://localhost:3001", { NODE_ENV: "development" }),
    "http://localhost:3001/api/waitlist",
  )
  assert.equal(
    endpointFor("https://app.staging.flowmark.dev", {
      VERCEL_ENV: "preview",
      VERCEL_GIT_COMMIT_REF: "staging",
    }),
    "https://app.staging.flowmark.dev/api/waitlist",
  )
  assert.equal(
    endpointFor("https://app.flowmark.dev", {
      VERCEL_ENV: "preview",
      VERCEL_GIT_COMMIT_REF: "codex/landing-waitlist",
    }),
    "https://flowmark-dashboard-git-codex-landing-waitlist-mumma6s-projects.vercel.app/api/waitlist",
  )
  assert.equal(
    endpointFor("https://app.flowmark.dev", { VERCEL_ENV: "preview" }),
    undefined,
  )
  assert.equal(
    endpointFor("https://app.flowmark.dev", {
      VERCEL_ENV: "preview",
      VERCEL_GIT_COMMIT_REF: "staging",
    }),
    undefined,
  )
  assert.equal(
    endpointFor("https://app.flowmark.dev", {
      VERCEL_ENV: "preview",
      VERCEL_GIT_COMMIT_REF: "main",
    }),
    undefined,
  )
})
