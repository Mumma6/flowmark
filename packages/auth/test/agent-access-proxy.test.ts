import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { Array as Arr, Effect, Option } from "effect"
import { createDatabase } from "@flowmark/db"
import { createFlowmarkAuth } from "../src/create-auth.js"
import { AGENT_ACCESS_REFERENCE_DEPLOYMENTS } from "../src/agent-access/protocol-contract.js"
import {
  AGENT_ACCESS_ISSUER_PROXY_PATHS,
  agentAccessUpstreamPath,
  decideAuthProxyLocation,
  oauthIssuerPath,
  redirectUriFromRequest,
} from "../src/agent-access/proxy-route.js"

const run = <A, E>(effect: Effect.Effect<A, E>) => Effect.runPromise(effect)

describe("issuer proxy routes", () => {
  it("maps only the approved issuer paths onto the API auth handler", async () => {
    const mapped = await run(
      Effect.forEach(
        [
          AGENT_ACCESS_ISSUER_PROXY_PATHS.authorizationServerMetadata,
          AGENT_ACCESS_ISSUER_PROXY_PATHS.openIdConfiguration,
          AGENT_ACCESS_ISSUER_PROXY_PATHS.jwks,
          "/oauth2/authorize",
          "/oauth2/token",
        ],
        (issuerPath) =>
          Effect.sync(() =>
            Option.getOrUndefined(agentAccessUpstreamPath(issuerPath)),
          ),
        { concurrency: 1 },
      ),
    )
    assert.deepEqual(mapped, [
      "/api/auth/.well-known/oauth-authorization-server",
      "/api/auth/.well-known/openid-configuration",
      "/api/auth/jwks",
      "/api/auth/oauth2/authorize",
      "/api/auth/oauth2/token",
    ])
    assert.equal(
      Option.isNone(
        agentAccessUpstreamPath("/.well-known/oauth-protected-resource"),
      ),
      true,
    )
    assert.equal(Option.isNone(agentAccessUpstreamPath("/oauth2-extra")), true)
    assert.equal(Option.isNone(oauthIssuerPath(["..", "token"])), true)
  })

  it("keeps a loopback callback bound to the authorization request", async () => {
    const location = await run(
      decideAuthProxyLocation({
        issuerPath: "/oauth2/authorize",
        requestUrl:
          "https://dashboard.example/oauth2/authorize?redirect_uri=http%3A%2F%2F127.0.0.1%3A4312%2Fcallback",
        redirectUri: "http://127.0.0.1:4312/callback",
        location: "http://127.0.0.1:4312/callback?code=synthetic&state=one",
      }),
    )
    assert.equal(
      location,
      "http://127.0.0.1:4312/callback?code=synthetic&state=one",
    )
  })

  it("rejects a substituted callback origin and ordinary-auth external redirects", async () => {
    const denied = await run(
      Effect.forEach(
        [
          {
            issuerPath: "/oauth2/authorize",
            redirectUri: "http://127.0.0.1:4312/callback",
            location: "https://untrusted.example/callback?code=synthetic",
          },
          {
            issuerPath: "/oauth2/authorize",
            redirectUri: "http://client.example/callback",
            location: "http://client.example/callback?code=synthetic",
          },
          {
            issuerPath: "/api/auth/reset-password/synthetic",
            redirectUri: "http://127.0.0.1:4312/callback",
            location: "http://127.0.0.1:4312/callback?code=synthetic",
          },
        ],
        (input) =>
          Effect.result(
            decideAuthProxyLocation({
              ...input,
              requestUrl: "https://dashboard.example/oauth2/authorize",
            }),
          ),
        { concurrency: 1 },
      ),
    )
    assert.equal(
      Arr.every(denied, (result) => result._tag === "Failure"),
      true,
    )
  })

  it("reads one redirect URI from the request and rejects a conflicting body", async () => {
    const query = await run(
      redirectUriFromRequest({
        requestUrl:
          "https://dashboard.example/oauth2/token?redirect_uri=https%3A%2F%2Fclient.example%2Fcallback",
        contentType: "application/json",
        body: JSON.stringify({
          grant_type: "authorization_code",
          redirect_uri: "https://client.example/callback",
          code: "synthetic",
        }),
      }),
    )
    assert.equal(query, "https://client.example/callback")
    const conflict = await run(
      Effect.result(
        redirectUriFromRequest({
          requestUrl:
            "https://dashboard.example/oauth2/authorize?redirect_uri=http%3A%2F%2F127.0.0.1%3A4312%2Fcallback",
          contentType: "application/x-www-form-urlencoded",
          body: "redirect_uri=https%3A%2F%2Funtrusted.example%2Fcallback",
        }),
      ),
    )
    assert.equal(conflict._tag, "Failure")
  })
})

const databaseUrl = Option.fromNullishOr(process.env.TEST_DATABASE_URL)

it(
  "returns a real provider authorization response across the issuer and API origins",
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
                Arr.contains(["localhost", "127.0.0.1", "[::1]"], hostname),
                true,
              )
              const database = yield* Effect.acquireRelease(
                Effect.sync(() => createDatabase(url)),
                (opened) => Effect.promise(() => opened.close()),
              )
              const local = AGENT_ACCESS_REFERENCE_DEPLOYMENTS.local
              const redirectUri = "http://127.0.0.1:4312/callback"
              const auth = createFlowmarkAuth({
                db: database.db,
                secret: "synthetic-test-secret-at-least-thirty-two-characters",
                baseURL: local.issuerOrigin,
                trustedOrigins: [local.issuerOrigin],
                agentAccess: {
                  issuerOrigin: local.issuerOrigin,
                  apiOrigin: local.apiOrigin,
                },
              })
              const query = new URLSearchParams({
                response_type: "code",
                client_id: "flowmark",
                redirect_uri: redirectUri,
                state: "one",
                code_challenge: "a".repeat(43),
                code_challenge_method: "S256",
              })
              const response = yield* Effect.promise(() =>
                auth.handler(
                  new Request(
                    `${local.apiOrigin}/api/auth/oauth2/authorize?${query}`,
                  ),
                ),
              )
              assert.equal(Arr.contains([200, 302, 400], response.status), true)
              const location = response.headers.get("location")
              if (location) {
                const forwarded = yield* decideAuthProxyLocation({
                  issuerPath: "/oauth2/authorize",
                  requestUrl: `${local.issuerOrigin}/oauth2/authorize?${query}`,
                  redirectUri,
                  location,
                })
                assert.equal(forwarded.length > 0, true)
              }
              assert.equal(
                response.headers.get("access-control-allow-origin"),
                null,
              )
            }),
          ),
      }),
    ),
)
