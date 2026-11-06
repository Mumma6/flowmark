import { createHash, randomBytes, randomUUID } from "node:crypto"
import assert from "node:assert/strict"
import { it } from "node:test"
import { eq, like } from "drizzle-orm"
import { Array as Arr, Effect, Option, Schema } from "effect"
import {
  createDatabase,
  oauthClient,
  oauthClientResource,
  oauthRefreshToken,
  verification,
} from "@flowmark/db"
import { createFlowmarkAuth } from "../src/create-auth.js"
import { AGENT_ACCESS_REFERENCE_DEPLOYMENTS } from "../src/agent-access/protocol-contract.js"
import { agentAccessUpstreamPath } from "../src/agent-access/proxy-route.js"
import { readAgentAccessGrantFamily } from "../src/agent-access/grant-family.js"

const databaseUrl = Option.fromNullishOr(process.env.TEST_DATABASE_URL)
const TokenResponse = Schema.Struct({
  access_token: Schema.String,
  refresh_token: Schema.optional(Schema.String),
  token_type: Schema.String,
})
const JwtClaims = Schema.Struct({
  iss: Schema.String,
  aud: Schema.Union([Schema.String, Schema.Array(Schema.String)]),
})
const OAuthError = Schema.Struct({
  error: Schema.String,
})

const codeChallenge = (verifier: string) =>
  createHash("sha256").update(verifier).digest("base64url")

const cookieOf = (response: Response) =>
  response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .join("; ")

it(
  "exchanges and refreshes a reference client without granting a project",
  { skip: Option.isNone(databaseUrl) },
  () =>
    Effect.runPromise(
      Option.match(databaseUrl, {
        onNone: () => Effect.void,
        onSome: (url) =>
          Effect.scoped(
            Effect.gen(function* () {
              const logged: unknown[][] = []
              const restore = yield* Effect.acquireRelease(
                Effect.sync(() => {
                  const error = console.error
                  const log = console.log
                  console.error = (...args: unknown[]) => {
                    logged.push(args)
                  }
                  console.log = (...args: unknown[]) => {
                    logged.push(args)
                  }
                  return { error, log }
                }),
                (original) =>
                  Effect.sync(() => {
                    console.error = original.error
                    console.log = original.log
                  }),
              )
              void restore
              const hostname = new URL(url).hostname
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
              const clientId = `reference-${randomUUID()}`
              const secret =
                "synthetic-test-secret-at-least-thirty-two-characters"
              const auth = createFlowmarkAuth({
                db: database.db,
                secret,
                baseURL: local.issuerOrigin,
                trustedOrigins: [local.issuerOrigin, local.apiOrigin],
                agentAccess: {
                  issuerOrigin: local.issuerOrigin,
                  apiOrigin: local.apiOrigin,
                },
              })
              const tokenPath = agentAccessUpstreamPath("/oauth2/token")
              assert.equal(
                Option.getOrUndefined(tokenPath),
                "/api/auth/oauth2/token",
              )
              const email = `${randomUUID()}@example.test`
              const password = `${randomUUID()}${randomUUID()}`
              const signup = yield* Effect.promise(() =>
                auth.handler(
                  new Request(`${local.apiOrigin}/api/auth/sign-up/email`, {
                    method: "POST",
                    headers: {
                      origin: local.issuerOrigin,
                      "content-type": "application/json",
                    },
                    body: JSON.stringify({
                      name: "Reference client",
                      email,
                      password,
                    }),
                  }),
                ),
              )
              assert.equal(signup.status, 200)
              const user = yield* Schema.decodeUnknownEffect(
                Schema.Struct({
                  user: Schema.Struct({ id: Schema.String }),
                }),
              )(yield* Effect.promise(() => signup.json()))
              const cookie = cookieOf(signup)
              yield* Effect.tryPromise({
                try: () =>
                  database.db.insert(oauthClient).values({
                    id: randomUUID(),
                    clientId,
                    name: "Flowmark reference",
                    redirectUris: [redirectUri],
                    grantTypes: ["authorization_code", "refresh_token"],
                    responseTypes: ["code"],
                    tokenEndpointAuthMethod: "none",
                    applicationType: "native",
                    requirePKCE: true,
                    skipConsent: true,
                    disabled: false,
                    scopes: [
                      "openid",
                      "profile",
                      "email",
                      "offline_access",
                      "flowmark:read",
                    ],
                    createdAt: new Date(),
                    updatedAt: new Date(),
                  }),
                catch: (cause) => cause,
              })
              yield* Effect.tryPromise({
                try: () =>
                  database.db.insert(oauthClientResource).values({
                    id: randomUUID(),
                    clientId,
                    resourceId: `${local.apiOrigin}/mcp`,
                    createdAt: new Date(),
                  }),
                catch: (cause) => cause,
              })
              const authorize = (verifier: string) => {
                const query = new URLSearchParams({
                  response_type: "code",
                  client_id: clientId,
                  redirect_uri: redirectUri,
                  state: "one",
                  scope: "openid profile email offline_access flowmark:read",
                  resource: `${local.apiOrigin}/mcp`,
                  code_challenge: codeChallenge(verifier),
                  code_challenge_method: "S256",
                })
                return Effect.promise(() =>
                  auth.handler(
                    new Request(
                      `${local.apiOrigin}/api/auth/oauth2/authorize?${query}`,
                      { headers: { cookie, origin: local.issuerOrigin } },
                    ),
                  ),
                )
              }
              const missingPkce = yield* Effect.promise(() =>
                auth.handler(
                  new Request(
                    `${local.apiOrigin}/api/auth/oauth2/authorize?${new URLSearchParams(
                      {
                        response_type: "code",
                        client_id: clientId,
                        redirect_uri: redirectUri,
                        state: "one",
                        scope: "openid flowmark:read",
                        resource: `${local.apiOrigin}/mcp`,
                      },
                    )}`,
                    { headers: { cookie, origin: local.issuerOrigin } },
                  ),
                ),
              )
              const missingLocation = missingPkce.headers.get("location")
              assert.equal(typeof missingLocation, "string")
              assert.equal(
                new URL(missingLocation ?? "").searchParams.get("error"),
                "invalid_request",
                missingLocation ?? `status ${missingPkce.status}`,
              )
              const wrongScope = yield* Effect.promise(() =>
                auth.handler(
                  new Request(
                    `${local.apiOrigin}/api/auth/oauth2/authorize?${new URLSearchParams(
                      {
                        response_type: "code",
                        client_id: clientId,
                        redirect_uri: redirectUri,
                        scope: "flowmark:admin",
                        code_challenge: codeChallenge("wrong-scope"),
                        code_challenge_method: "S256",
                      },
                    )}`,
                    { headers: { cookie, origin: local.issuerOrigin } },
                  ),
                ),
              )
              assert.equal(
                new URL(
                  wrongScope.headers.get("location") ?? "",
                ).searchParams.get("error"),
                "invalid_scope",
              )
              const verifier = randomBytes(32).toString("base64url")
              const issued = yield* authorize(verifier)
              const issuedUrl = new URL(issued.headers.get("location") ?? "")
              const code = issuedUrl.searchParams.get("code")
              assert.equal(typeof code, "string")
              yield* Effect.tryPromise({
                try: () =>
                  database.db
                    .update(verification)
                    .set({ expiresAt: new Date(0) })
                    .where(
                      like(verification.value, `%"userId":"${user.user.id}"%`),
                    ),
                catch: (cause) => cause,
              })
              const expired = yield* Effect.promise(() =>
                auth.handler(
                  new Request(`${local.apiOrigin}/api/auth/oauth2/token`, {
                    method: "POST",
                    headers: {
                      origin: local.issuerOrigin,
                      "content-type": "application/x-www-form-urlencoded",
                    },
                    body: new URLSearchParams({
                      grant_type: "authorization_code",
                      client_id: clientId,
                      code: code ?? "",
                      redirect_uri: redirectUri,
                      code_verifier: verifier,
                      resource: `${local.apiOrigin}/mcp`,
                    }).toString(),
                  }),
                ),
              )
              assert.equal(expired.status, 400)
              const freshVerifier = randomBytes(32).toString("base64url")
              const fresh = yield* authorize(freshVerifier)
              const freshCode = new URL(
                fresh.headers.get("location") ?? "",
              ).searchParams.get("code")
              const exchanged = yield* Effect.promise(() =>
                auth.handler(
                  new Request(`${local.apiOrigin}/api/auth/oauth2/token`, {
                    method: "POST",
                    headers: {
                      origin: local.issuerOrigin,
                      "content-type": "application/x-www-form-urlencoded",
                    },
                    body: new URLSearchParams({
                      grant_type: "authorization_code",
                      client_id: clientId,
                      code: freshCode ?? "",
                      redirect_uri: redirectUri,
                      code_verifier: freshVerifier,
                      resource: `${local.apiOrigin}/mcp`,
                    }).toString(),
                  }),
                ),
              )
              assert.equal(exchanged.status, 200)
              const tokens = yield* Schema.decodeUnknownEffect(TokenResponse)(
                yield* Effect.promise(() => exchanged.json()),
              )
              const claims = yield* Schema.decodeUnknownEffect(JwtClaims)(
                JSON.parse(
                  Buffer.from(
                    tokens.access_token.split(".")[1] ?? "",
                    "base64url",
                  ).toString("utf8"),
                ),
              )
              assert.equal(claims.iss, local.issuerOrigin)
              assert.equal(
                Arr.contains(
                  typeof claims.aud === "string" ? [claims.aud] : claims.aud,
                  `${local.apiOrigin}/mcp`,
                ),
                true,
              )
              const family = yield* readAgentAccessGrantFamily(database.db, {
                subjectUserId: user.user.id,
                clientId,
                issuer: local.issuerOrigin,
                resource: `${local.apiOrigin}/mcp`,
              })
              assert.equal("projectId" in family, false)
              assert.equal(family.issuer, local.issuerOrigin)
              assert.equal(family.resource, `${local.apiOrigin}/mcp`)
              const refreshToken = tokens.refresh_token
              assert.equal(typeof refreshToken, "string")
              const refreshed = yield* Effect.promise(() =>
                auth.handler(
                  new Request(`${local.apiOrigin}/api/auth/oauth2/token`, {
                    method: "POST",
                    headers: {
                      origin: local.issuerOrigin,
                      "content-type": "application/x-www-form-urlencoded",
                    },
                    body: new URLSearchParams({
                      grant_type: "refresh_token",
                      client_id: clientId,
                      refresh_token: refreshToken ?? "",
                      resource: `${local.apiOrigin}/mcp`,
                    }).toString(),
                  }),
                ),
              )
              assert.equal(refreshed.status, 200)
              const rotated = yield* Schema.decodeUnknownEffect(TokenResponse)(
                yield* Effect.promise(() => refreshed.json()),
              )
              assert.equal(typeof rotated.refresh_token, "string")
              assert.equal(rotated.refresh_token === refreshToken, false)
              const wrongResource = yield* Effect.promise(() =>
                auth.handler(
                  new Request(`${local.apiOrigin}/api/auth/oauth2/token`, {
                    method: "POST",
                    headers: {
                      origin: local.issuerOrigin,
                      "content-type": "application/x-www-form-urlencoded",
                    },
                    body: new URLSearchParams({
                      grant_type: "refresh_token",
                      client_id: clientId,
                      refresh_token: rotated.refresh_token ?? "",
                      resource: "https://untrusted.example/mcp",
                    }).toString(),
                  }),
                ),
              )
              assert.equal(wrongResource.status, 400)
              const error = yield* Schema.decodeUnknownEffect(OAuthError)(
                yield* Effect.promise(() => wrongResource.json()),
              )
              assert.equal(error.error.length > 0, true)
              const reused = yield* Effect.promise(() =>
                auth.handler(
                  new Request(`${local.apiOrigin}/api/auth/oauth2/token`, {
                    method: "POST",
                    headers: {
                      origin: local.issuerOrigin,
                      "content-type": "application/x-www-form-urlencoded",
                    },
                    body: new URLSearchParams({
                      grant_type: "refresh_token",
                      client_id: clientId,
                      refresh_token: refreshToken ?? "",
                      resource: `${local.apiOrigin}/mcp`,
                    }).toString(),
                  }),
                ),
              )
              assert.equal(reused.status, 200)
              const closed = yield* Effect.tryPromise(() =>
                database.db
                  .update(oauthRefreshToken)
                  .set({ rotationReplayExpiresAt: null })
                  .where(eq(oauthRefreshToken.clientId, clientId))
                  .returning({ id: oauthRefreshToken.id }),
              )
              assert.equal(closed.length > 0, true)
              const reusedLate = yield* Effect.promise(() =>
                auth.handler(
                  new Request(`${local.apiOrigin}/api/auth/oauth2/token`, {
                    method: "POST",
                    headers: {
                      origin: local.issuerOrigin,
                      "content-type": "application/x-www-form-urlencoded",
                    },
                    body: new URLSearchParams({
                      grant_type: "refresh_token",
                      client_id: clientId,
                      refresh_token: refreshToken ?? "",
                      resource: `${local.apiOrigin}/mcp`,
                    }).toString(),
                  }),
                ),
              )
              assert.equal(reusedLate.status, 400)
              const replay = yield* Effect.promise(() =>
                auth.handler(
                  new Request(`${local.apiOrigin}/api/auth/oauth2/token`, {
                    method: "POST",
                    headers: {
                      origin: local.issuerOrigin,
                      "content-type": "application/x-www-form-urlencoded",
                    },
                    body: new URLSearchParams({
                      grant_type: "authorization_code",
                      client_id: clientId,
                      code: freshCode ?? "",
                      redirect_uri: redirectUri,
                      code_verifier: freshVerifier,
                      resource: `${local.apiOrigin}/mcp`,
                    }).toString(),
                  }),
                ),
              )
              assert.equal(replay.status, 400)
              const output = JSON.stringify(logged)
              assert.equal(output.includes(tokens.access_token), false)
              assert.equal(output.includes(refreshToken ?? ""), false)
              assert.equal(output.includes(freshCode ?? ""), false)
            }),
          ),
      }),
    ),
)
