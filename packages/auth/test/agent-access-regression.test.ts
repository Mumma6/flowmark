import { createHash, randomBytes, randomUUID } from "node:crypto"
import assert from "node:assert/strict"
import { it } from "node:test"
import {
  Array as Arr,
  Cause,
  Effect,
  Exit,
  Option,
  Result,
  Schema,
} from "effect"
import { createDatabase, oauthClient, oauthClientResource } from "@flowmark/db"
import { Email, makeEmailCapture } from "@flowmark/email"
import { createFlowmarkAuth } from "../src/create-auth.js"
import { AUTH_PROXY_IDENTITY_HEADER } from "../src/client-identity.js"
import { flowmarkAuthorizationServerMetadata } from "../src/agent-access/compose-provider.js"
import { AGENT_ACCESS_REFERENCE_DEPLOYMENTS } from "../src/agent-access/protocol-contract.js"

const databaseUrl = Option.fromNullishOr(process.env.TEST_DATABASE_URL)
const secret = "synthetic-test-secret-at-least-thirty-two-characters"
const TokenResponse = Schema.Struct({
  access_token: Schema.String,
  token_type: Schema.String,
})
const OAuthError = Schema.Struct({ error: Schema.String })
const UserBody = Schema.Struct({
  user: Schema.Struct({ id: Schema.String }),
})

const codeChallenge = (verifier: string) =>
  createHash("sha256").update(verifier).digest("base64url")

const cookieOf = (response: Response) =>
  response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .join("; ")

const readJson = (response: Response) =>
  Effect.tryPromise({
    try: () => response.text(),
    catch: (cause) => cause,
  }).pipe(
    Effect.flatMap((text) =>
      text.length === 0
        ? Effect.succeed(null)
        : Effect.try({
            try: () => JSON.parse(text) as unknown,
            catch: (cause) => cause,
          }),
    ),
  )

const userIdOf = (body: unknown) =>
  Schema.decodeUnknownResult(UserBody)(body).pipe(
    Result.match({
      onFailure: () => Option.none<string>(),
      onSuccess: (decoded) => Option.some(decoded.user.id),
    }),
  )

it(
  "keeps ordinary auth closed when a provider token has no project grant",
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
              const mismatch = Effect.runSyncExit(
                Effect.sync(() =>
                  createFlowmarkAuth({
                    db: {} as Parameters<typeof createFlowmarkAuth>[0]["db"],
                    secret,
                    baseURL: "http://127.0.0.1:3001",
                    agentAccess: {
                      issuerOrigin: "http://localhost:3001",
                      apiOrigin: "http://localhost:3000",
                    },
                  }),
                ),
              )
              assert.equal(Exit.isFailure(mismatch), true)
              const mismatchText = Exit.isFailure(mismatch)
                ? Cause.pretty(mismatch.cause)
                : ""
              assert.equal(mismatchText.includes(secret), false)
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
              const email = `${randomUUID()}@example.test`
              const password = `${randomUUID()}${randomUUID()}`
              const capture = yield* makeEmailCapture(
                local.issuerOrigin,
                "local",
              )
              const delivery = yield* Email.pipe(Effect.provide(capture.layer))
              const auth = createFlowmarkAuth({
                db: database.db,
                secret,
                baseURL: local.issuerOrigin,
                trustedOrigins: [local.issuerOrigin, local.apiOrigin],
                emailDelivery: delivery,
                agentAccess: {
                  issuerOrigin: local.issuerOrigin,
                  apiOrigin: local.apiOrigin,
                },
              })
              const context = yield* Effect.promise(() => auth.$context)
              assert.equal(
                Arr.contains(
                  Arr.map(context.options.plugins ?? [], (plugin) => plugin.id),
                  "flowmark-account-rate-limits",
                ),
                true,
              )
              assert.equal(context.options.advanced?.disableCSRFCheck, false)
              const signup = yield* Effect.promise(() =>
                auth.handler(
                  new Request(`${local.apiOrigin}/api/auth/sign-up/email`, {
                    method: "POST",
                    headers: {
                      origin: local.issuerOrigin,
                      "content-type": "application/json",
                    },
                    body: JSON.stringify({
                      name: "Ordinary account",
                      email,
                      password,
                    }),
                  }),
                ),
              )
              assert.equal(signup.status, 200)
              const userId = yield* Option.match(
                userIdOf(yield* readJson(signup)),
                {
                  onNone: () =>
                    Effect.fail(new Error("Signup did not return a user.")),
                  onSome: (id) => Effect.succeed(id),
                },
              )
              const cookie = cookieOf(signup)
              const signIn = yield* Effect.promise(() =>
                auth.handler(
                  new Request(`${local.apiOrigin}/api/auth/sign-in/email`, {
                    method: "POST",
                    headers: {
                      origin: local.issuerOrigin,
                      "content-type": "application/json",
                    },
                    body: JSON.stringify({ email, password }),
                  }),
                ),
              )
              assert.equal(signIn.status, 200)
              const foreign = yield* Effect.promise(() =>
                auth.handler(
                  new Request(`${local.apiOrigin}/api/auth/sign-in/email`, {
                    method: "POST",
                    headers: {
                      origin: "https://evil.example",
                      "content-type": "application/json",
                    },
                    body: JSON.stringify({ email, password }),
                  }),
                ),
              )
              assert.equal(foreign.status, 403)
              const forged = yield* Effect.promise(() =>
                auth.handler(
                  new Request(`${local.apiOrigin}/api/auth/sign-in/email`, {
                    method: "POST",
                    headers: {
                      origin: local.issuerOrigin,
                      "content-type": "application/json",
                      [AUTH_PROXY_IDENTITY_HEADER]: "forged-proxy-identity",
                    },
                    body: JSON.stringify({ email, password }),
                  }),
                ),
              )
              assert.equal(Arr.contains([403, 503], forged.status), true)
              const forgedBody = JSON.stringify(yield* readJson(forged))
              assert.equal(forgedBody.includes(password), false)
              assert.equal(forgedBody.includes("forged-proxy-identity"), false)
              const recovery = yield* Effect.promise(() =>
                auth.handler(
                  new Request(
                    `${local.issuerOrigin}/api/auth/request-password-reset`,
                    {
                      method: "POST",
                      headers: {
                        origin: local.issuerOrigin,
                        "content-type": "application/json",
                      },
                      body: JSON.stringify({
                        email,
                        redirectTo: `${local.issuerOrigin}/reset-password`,
                      }),
                    },
                  ),
                ),
              )
              assert.equal(recovery.status, 200)
              const recoveryBody = JSON.stringify(yield* readJson(recovery))
              const messages = yield* capture.read
              const reset = Arr.findFirst(messages, (message) =>
                message.subject.includes("Reset"),
              )
              const resetToken = Option.match(reset, {
                onNone: () => "",
                onSome: (message) =>
                  message.text.match(/Reset password: (\S+)/)?.[1] ?? "",
              })
              assert.equal(resetToken.length > 0, true)
              assert.equal(recoveryBody.includes(password), false)
              assert.equal(recoveryBody.includes(resetToken), false)
              const session = yield* Effect.promise(() =>
                auth.handler(
                  new Request(`${local.issuerOrigin}/api/auth/get-session`, {
                    headers: { cookie, origin: local.issuerOrigin },
                  }),
                ),
              )
              assert.equal(session.status, 200)
              assert.equal(
                Option.getOrUndefined(userIdOf(yield* readJson(session))),
                userId,
              )
              yield* Effect.tryPromise(() =>
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
              )
              yield* Effect.tryPromise(() =>
                database.db.insert(oauthClientResource).values({
                  id: randomUUID(),
                  clientId,
                  resourceId: `${local.apiOrigin}/mcp`,
                  createdAt: new Date(),
                }),
              )
              const verifier = randomBytes(32).toString("base64url")
              const authorized = yield* Effect.promise(() =>
                auth.handler(
                  new Request(
                    `${local.apiOrigin}/api/auth/oauth2/authorize?${new URLSearchParams(
                      {
                        response_type: "code",
                        client_id: clientId,
                        redirect_uri: redirectUri,
                        scope:
                          "openid profile email offline_access flowmark:read",
                        resource: `${local.apiOrigin}/mcp`,
                        code_challenge: codeChallenge(verifier),
                        code_challenge_method: "S256",
                      },
                    )}`,
                    { headers: { cookie, origin: local.issuerOrigin } },
                  ),
                ),
              )
              const code = new URL(
                authorized.headers.get("location") ?? "",
              ).searchParams.get("code")
              assert.equal(typeof code, "string")
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
                      code: code ?? "",
                      redirect_uri: redirectUri,
                      code_verifier: verifier,
                      resource: `${local.apiOrigin}/mcp`,
                    }).toString(),
                  }),
                ),
              )
              assert.equal(exchanged.status, 200)
              const tokens = yield* Schema.decodeUnknownEffect(TokenResponse)(
                yield* readJson(exchanged),
              )
              const bearerSession = yield* Effect.promise(() =>
                auth.handler(
                  new Request(`${local.issuerOrigin}/api/auth/get-session`, {
                    headers: {
                      authorization: `Bearer ${tokens.access_token}`,
                      origin: local.issuerOrigin,
                    },
                  }),
                ),
              )
              assert.equal(
                Option.getOrUndefined(userIdOf(yield* readJson(bearerSession))),
                undefined,
              )
              const mcp = yield* Effect.promise(() =>
                auth.handler(
                  new Request(`${local.apiOrigin}/mcp`, {
                    method: "POST",
                    headers: {
                      authorization: `Bearer ${tokens.access_token}`,
                      origin: local.issuerOrigin,
                      "content-type": "application/json",
                    },
                    body: JSON.stringify({
                      jsonrpc: "2.0",
                      method: "tools/list",
                    }),
                  }),
                ),
              )
              assert.notEqual(mcp.status, 200)
              const rejected = yield* Effect.promise(() =>
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
                      code: "not-a-code",
                      redirect_uri: redirectUri,
                      code_verifier: verifier,
                      resource: `${local.apiOrigin}/mcp`,
                    }).toString(),
                  }),
                ),
              )
              assert.equal(rejected.status, 400)
              const oauthError = yield* Schema.decodeUnknownEffect(OAuthError)(
                yield* readJson(rejected),
              )
              assert.equal(oauthError.error.length > 0, true)
              assert.equal(
                JSON.stringify(oauthError).includes(tokens.access_token),
                false,
              )
              const disabled = createFlowmarkAuth({
                db: database.db,
                secret,
                baseURL: local.issuerOrigin,
                trustedOrigins: [local.issuerOrigin],
              })
              const hidden = yield* Effect.promise(() =>
                flowmarkAuthorizationServerMetadata(disabled)(
                  new Request(
                    `${local.issuerOrigin}/.well-known/oauth-authorization-server`,
                  ),
                ),
              )
              assert.equal(hidden.status, 404)
              const hiddenToken = yield* Effect.promise(() =>
                disabled.handler(
                  new Request(`${local.apiOrigin}/api/auth/oauth2/token`, {
                    method: "POST",
                    headers: {
                      origin: local.issuerOrigin,
                      "content-type": "application/x-www-form-urlencoded",
                    },
                    body: "grant_type=authorization_code",
                  }),
                ),
              )
              assert.notEqual(hiddenToken.status, 200)
              const output = JSON.stringify(logged)
              assert.equal(output.includes(password), false)
              assert.equal(output.includes(tokens.access_token), false)
              assert.equal(output.includes(resetToken), false)
              assert.equal(output.includes(code ?? ""), false)
            }),
          ),
      }),
    ),
)
