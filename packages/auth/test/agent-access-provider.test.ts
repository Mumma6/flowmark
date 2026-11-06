import assert from "node:assert/strict"
import { test } from "node:test"
import { sql } from "drizzle-orm"
import {
  Array as EffectArray,
  Cause,
  Effect,
  Exit,
  Option,
  Schema,
} from "effect"
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
const DiscoveryDocument = Schema.Record(Schema.String, Schema.Unknown)
const StringList = Schema.Array(Schema.String)

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

const readDocument = (response: Response) =>
  Effect.tryPromise({
    try: () => response.json() as Promise<unknown>,
    catch: (cause) => cause,
  }).pipe(Effect.flatMap(Schema.decodeUnknownEffect(DiscoveryDocument)))

const stringList = (document: Record<string, unknown>, key: string) =>
  Schema.decodeUnknownEffect(StringList)(document[key])

test("disabled agent access keeps ordinary auth and hides discovery", () =>
  Effect.runPromise(
    Effect.gen(function* () {
      const local = AGENT_ACCESS_REFERENCE_DEPLOYMENTS.local
      const auth = authFor(local, false)
      const context = yield* Effect.promise(() => auth.$context)
      assert.deepEqual(
        EffectArray.map(context.options.plugins ?? [], (plugin) => plugin.id),
        ["flowmark-account-rate-limits"],
      )
      assert.equal(context.options.advanced?.disableCSRFCheck, false)
      assert.equal(context.options.advanced?.disableOriginCheck, false)
      assert.equal(context.options.emailAndPassword?.enabled, true)
      const response = yield* Effect.promise(() =>
        flowmarkAuthorizationServerMetadata(auth)(
          new Request(
            `${local.issuerOrigin}/.well-known/oauth-authorization-server`,
          ),
        ),
      )
      assert.equal(response.status, 404)
      assert.equal(
        FLOWMARK_AGENT_ACCESS_PROVIDER.tokenAloneGrantsProject,
        false,
      )
      assert.equal(
        Exit.isFailure(
          Effect.runSyncExit(requireAgentAccessProjectId("get_run", undefined)),
        ),
        true,
      )
    }),
  ))

test("enabled discovery uses canonical local and self-host values", () =>
  Effect.runPromise(
    Effect.forEach(
      [
        AGENT_ACCESS_REFERENCE_DEPLOYMENTS.local,
        AGENT_ACCESS_REFERENCE_DEPLOYMENTS.production,
      ],
      (deployment) =>
        Effect.gen(function* () {
          const auth = authFor(deployment, true)
          const context = yield* Effect.promise(() => auth.$context)
          assert.deepEqual(
            EffectArray.map(
              context.options.plugins ?? [],
              (plugin) => plugin.id,
            ),
            [
              "flowmark-account-rate-limits",
              ...FLOWMARK_AGENT_ACCESS_PROVIDER.pluginIdsWhenEnabled,
            ],
          )
          const metadata = yield* Effect.promise(() =>
            flowmarkAuthorizationServerMetadata(auth)(
              new Request(
                `${deployment.issuerOrigin}/.well-known/oauth-authorization-server`,
              ),
            ),
          ).pipe(Effect.flatMap(readDocument))
          const scopes = yield* stringList(metadata, "scopes_supported")
          const grants = yield* stringList(metadata, "grant_types_supported")
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
          assert.equal(EffectArray.contains(scopes, "flowmark:read"), true)
          assert.equal(
            EffectArray.contains(grants, "client_credentials"),
            false,
          )
          assert.equal(JSON.stringify(metadata).includes("projectId"), false)
          const openId = yield* Effect.promise(() =>
            flowmarkOpenIdConfiguration(auth)(
              new Request(
                `${deployment.issuerOrigin}/.well-known/openid-configuration`,
              ),
            ),
          ).pipe(Effect.flatMap(readDocument))
          const claims = yield* stringList(openId, "claims_supported")
          assert.equal(openId.issuer, deployment.issuerOrigin)
          assert.equal(EffectArray.contains(claims, "project_id"), false)
        }),
      { concurrency: 1 },
    ),
  ))

test("hosted HTTP resources are rejected before the provider is composed", () => {
  const exit = Effect.runSyncExit(
    Effect.try({
      try: () =>
        authFor(
          {
            issuerOrigin: "http://agent.example",
            apiOrigin: "http://api.example",
          },
          true,
        ),
      catch: (cause) => cause,
    }),
  )
  assert.equal(Exit.isFailure(exit), true)
  if (Exit.isFailure(exit)) {
    assert.match(
      Cause.pretty(exit.cause),
      /HTTPS|AuthConfigurationError|MCP resource/,
    )
  }
})

const databaseUrl = Option.fromNullishOr(process.env.TEST_DATABASE_URL)

test(
  "provider signing keys persist and stay out of the JWKS response",
  { skip: Option.isNone(databaseUrl) },
  () =>
    Effect.runPromise(
      Option.match(databaseUrl, {
        onNone: () => Effect.void,
        onSome: (url) =>
          Effect.scoped(
            Effect.gen(function* () {
              const hostname = yield* Effect.try({
                try: () => new URL(url).hostname,
                catch: (cause) => cause,
              })
              assert.equal(
                EffectArray.contains(
                  ["localhost", "127.0.0.1", "[::1]"],
                  hostname,
                ),
                true,
              )
              const database = yield* Effect.acquireRelease(
                Effect.sync(() => createDatabase(url)),
                (opened) => Effect.promise(() => opened.close()),
              )
              const local = AGENT_ACCESS_REFERENCE_DEPLOYMENTS.local
              const auth = createFlowmarkAuth({
                db: database.db,
                secret,
                baseURL: local.issuerOrigin,
                trustedOrigins: [local.issuerOrigin],
                agentAccess: {
                  issuerOrigin: local.issuerOrigin,
                  apiOrigin: local.apiOrigin,
                },
              })
              const response = yield* Effect.promise(() =>
                auth.handler(
                  new Request(`${local.issuerOrigin}/api/auth/jwks`),
                ),
              )
              assert.equal(response.status, 200)
              const body = yield* Effect.promise(() => response.text())
              assert.equal(body.includes("private"), false)
              const rows = yield* Effect.tryPromise({
                try: () =>
                  database.db.execute<{ count: number }>(
                    sql`SELECT count(*)::int AS count FROM jwks WHERE private_key IS NOT NULL`,
                  ),
                catch: (cause) => cause,
              })
              assert.equal(EffectArray.fromIterable(rows)[0]?.count, 1)
            }),
          ),
      }),
    ),
)
