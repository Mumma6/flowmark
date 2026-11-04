import assert from "node:assert/strict"
import { test } from "node:test"
import { Effect } from "effect"
import {
  checkRuntime,
  checkStagingUrls,
  checkNeonIdentity,
} from "../src/environment/target.js"
import { makeAuthHttp } from "../src/provisioning/auth-http.js"
import { checkStagingDeployments } from "../src/environment/deployment.js"

test("production, Preview, hosted runtimes and unsafe overrides fail before any connection", async () => {
  await assert.rejects(Effect.runPromise(checkRuntime("production", {})))
  await assert.rejects(Effect.runPromise(checkRuntime("preview", {})))
  await assert.rejects(
    Effect.runPromise(checkRuntime("local", { NODE_ENV: "production" })),
  )
  await assert.rejects(
    Effect.runPromise(checkRuntime("staging", { VERCEL_ENV: "preview" })),
  )
  await assert.rejects(
    Effect.runPromise(checkRuntime("staging", { DATABASE_URL: "not-read" })),
  )
  await assert.rejects(
    Effect.runPromise(
      checkRuntime("staging", { DATABASE_MIGRATION_URL: "not-read" }),
    ),
  )
  await Effect.runPromise(checkRuntime("staging", {}))
})

test("Staging label is insufficient: compare all endpoint hosts and fresh branch identity", async () => {
  const env = (host: string) =>
    new Map([
      ["NEON_BRANCH", "staging"],
      [
        "DATABASE_URL_UNPOOLED",
        `postgresql://synthetic:unused@${host}/neondb?sslmode=require`,
      ],
    ])
  const staging = env("ep-staging.neon.tech")
  const production = env("ep-production.neon.tech")
  const preview = env("ep-preview.neon.tech")
  await assert.rejects(
    Effect.runPromise(checkStagingUrls(production, production, preview)),
  )
  await assert.rejects(
    Effect.runPromise(checkStagingUrls(env("127.0.0.1"), production, preview)),
  )
  await Effect.runPromise(checkStagingUrls(staging, production, preview))
  const branches = {
    branches: [
      { id: "br-staging", name: "staging", project_id: "test-project" },
      { id: "br-production", name: "production", project_id: "test-project" },
    ],
  }
  const endpoint = (id: string) => ({
    endpoints: [
      {
        host: "ep-staging.neon.tech",
        branch_id: id,
        project_id: "test-project",
      },
    ],
  })
  await assert.rejects(
    Effect.runPromise(
      checkNeonIdentity(
        "ep-staging.neon.tech",
        "test-project",
        branches,
        endpoint("br-production"),
      ),
    ),
  )
  await assert.rejects(
    Effect.runPromise(
      checkNeonIdentity(
        "ep-staging.neon.tech",
        "other-project",
        branches,
        endpoint("br-staging"),
      ),
    ),
  )
  await Effect.runPromise(
    checkNeonIdentity(
      "ep-staging.neon.tech",
      "test-project",
      branches,
      endpoint("br-staging"),
    ),
  )
})

test("auth cannot redirect provisioning to Production or send unrelated auth requests", async () => {
  let sent = 0
  const send = () => {
    sent += 1
    return Promise.resolve(Response.json({}))
  }
  await assert.rejects(
    Effect.runPromise(makeAuthHttp("https://app.flowmark.dev", send)),
  )
  const http = await Effect.runPromise(
    makeAuthHttp("https://app.staging.flowmark.dev", send),
  )
  await assert.rejects(
    Effect.runPromise(http.request("/request-password-reset", {})),
  )
  assert.equal(sent, 0)
})

test("account setup refuses Production and mismatched or stale deployment identities", async () => {
  const deployment = (name: string) => ({
    name,
    readyState: "READY",
    target: null,
    meta: { githubCommitRef: "staging", githubCommitSha: "a".repeat(40) },
  })
  const dashboard = deployment("flowmark-dashboard")
  const api = deployment("flowmark-api")
  await Effect.runPromise(checkStagingDeployments(dashboard, api))
  await assert.rejects(
    Effect.runPromise(
      checkStagingDeployments({ ...dashboard, target: "production" }, api),
    ),
  )
  await assert.rejects(
    Effect.runPromise(
      checkStagingDeployments(
        { ...dashboard, meta: { ...dashboard.meta, githubCommitRef: "main" } },
        api,
      ),
    ),
  )
  await assert.rejects(
    Effect.runPromise(
      checkStagingDeployments(dashboard, {
        ...api,
        meta: { ...api.meta, githubCommitSha: "b".repeat(40) },
      }),
    ),
  )
})
