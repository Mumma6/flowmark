import assert from "node:assert/strict"
import { test } from "node:test"
import { sql } from "drizzle-orm"
import { Effect, Exit } from "effect"
import { createDatabase } from "@flowmark/db"
import { createFlowmarkAuth } from "../src/create-auth.js"
import { requireAgentAccessProjectId } from "../src/agent-access/protocol-contract.js"
import {
  FLOWMARK_AGENT_ACCESS_PROVIDER,
  flowmarkAuthorizationServerMetadata,
  flowmarkOpenIdConfiguration,
} from "../src/agent-access/compose-provider.js"
import { AGENT_ACCESS_REFERENCE_DEPLOYMENTS } from "../src/agent-access/protocol-contract.js"

const secret = "synthetic-test-secret-at-least-thirty-two-characters"
const stub = {} as Parameters<typeof createFlowmarkAuth>[0]["db"]

const authFor = (
  deployment: { readonly issuerOrigin: string; readonly apiOrigin: string },
  enabled: boolean,
) =>
  createFlowmarkAuth({
    db: stub,
    secret,
    baseURL: deployment.issuerOrigin,
    trustedOrigins: [deployment.issuerOrigin],
    agentAccess: enabled
      ? {
          issuerOrigin: deployment.issuerOrigin,
          apiOrigin: deployment.apiOrigin,
        }
      : undefined,
  })

test("disabled agent access keeps ordinary auth and hides discovery", async () => {
  const local = AGENT_ACCESS_REFERENCE_DEPLOYMENTS.local
  const auth = authFor(local, false)
  const context = await auth.$context
  assert.deepEqual(
    context.options.plugins?.map((plugin) => plugin.id),
    ["flowmark-account-rate-limits"],
  )
  assert.equal(context.options.advanced?.disableCSRFCheck, false)
  assert.equal(context.options.advanced?.disableOriginCheck, false)
  assert.equal(context.options.emailAndPassword?.enabled, true)
  assert.equal(
    (
      await flowmarkAuthorizationServerMetadata(auth)(
        new Request(
          `${local.issuerOrigin}/.well-known/oauth-authorization-server`,
        ),
      )
    ).status,
    404,
  )
  assert.equal(FLOWMARK_AGENT_ACCESS_PROVIDER.tokenAloneGrantsProject, false)
  assert.equal(
    Exit.isFailure(
      Effect.runSyncExit(requireAgentAccessProjectId("get_run", undefined)),
    ),
    true,
  )
})

test("enabled discovery uses canonical local and self-host values", async () => {
  for (const deployment of [
    AGENT_ACCESS_REFERENCE_DEPLOYMENTS.local,
    AGENT_ACCESS_REFERENCE_DEPLOYMENTS.production,
  ]) {
    const auth = authFor(deployment, true)
    const context = await auth.$context
    assert.deepEqual(
      context.options.plugins?.map((plugin) => plugin.id),
      [
        "flowmark-account-rate-limits",
        ...FLOWMARK_AGENT_ACCESS_PROVIDER.pluginIdsWhenEnabled,
      ],
    )
    const metadata = await (
      await flowmarkAuthorizationServerMetadata(auth)(
        new Request(
          `${deployment.issuerOrigin}/.well-known/oauth-authorization-server`,
        ),
      )
    ).json()
    assert.equal(metadata.issuer, deployment.issuerOrigin)
    assert.equal(
      metadata.authorization_endpoint,
      `${deployment.issuerOrigin}/oauth2/authorize`,
    )
    assert.equal(
      metadata.token_endpoint,
      `${deployment.issuerOrigin}/oauth2/token`,
    )
    assert.equal(metadata.jwks_uri, `${deployment.issuerOrigin}/jwks`)
    assert.equal(metadata.registration_endpoint, undefined)
    assert.equal(metadata.scopes_supported.includes("flowmark:read"), true)
    assert.equal(
      metadata.grant_types_supported.includes("client_credentials"),
      false,
    )
    assert.equal(JSON.stringify(metadata).includes("projectId"), false)
    const openId = await (
      await flowmarkOpenIdConfiguration(auth)(
        new Request(
          `${deployment.issuerOrigin}/.well-known/openid-configuration`,
        ),
      )
    ).json()
    assert.equal(openId.issuer, deployment.issuerOrigin)
    assert.equal(openId.claims_supported.includes("project_id"), false)
  }
})

test("hosted HTTP resources are rejected before the provider is composed", () => {
  assert.throws(
    () =>
      authFor(
        {
          issuerOrigin: "http://agent.example",
          apiOrigin: "http://api.example",
        },
        true,
      ),
    /HTTPS|AuthConfigurationError|MCP resource/,
  )
})

const databaseUrl = process.env.TEST_DATABASE_URL

test(
  "provider signing keys persist and stay out of the JWKS response",
  { skip: !databaseUrl },
  async () => {
    assert.ok(
      ["localhost", "127.0.0.1", "[::1]"].includes(
        new URL(databaseUrl!).hostname,
      ),
    )
    const local = AGENT_ACCESS_REFERENCE_DEPLOYMENTS.local
    const { db, close } = createDatabase(databaseUrl!)
    try {
      const auth = createFlowmarkAuth({
        db,
        secret,
        baseURL: local.issuerOrigin,
        trustedOrigins: [local.issuerOrigin],
        agentAccess: {
          issuerOrigin: local.issuerOrigin,
          apiOrigin: local.apiOrigin,
        },
      })
      const response = await auth.handler(
        new Request(`${local.issuerOrigin}/api/auth/jwks`),
      )
      assert.equal(response.status, 200)
      const body = await response.json()
      assert.equal(JSON.stringify(body).includes("private"), false)
      const rows = await db.execute<{ count: number }>(
        sql`SELECT count(*)::int AS count FROM jwks WHERE private_key IS NOT NULL`,
      )
      assert.equal(Array.from(rows)[0]?.count, 1)
    } finally {
      await close()
    }
  },
)
