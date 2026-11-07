import { createHash, randomBytes, randomUUID } from "node:crypto"
import assert from "node:assert/strict"
import { eq, like } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import {
  createDatabase,
  oauthClient,
  oauthClientResource,
  oauthConsent,
  oauthRefreshToken,
  verification,
} from "@flowmark/db"
import {
  createOwnedProject,
  Database,
  submitAgentAccessConsent,
} from "@flowmark/db/persistence"
import { Effect } from "effect"
import { LATEST_PROTOCOL_VERSION } from "@flowmark/mcp"
import { POST as mcpPost } from "../../app/mcp/route"
import {
  handleMcpPost,
  resetMcpRouteCacheForTests,
} from "../../src/adapters/mcp/route"

const issuerOrigin = "http://127.0.0.1:3901"
const apiOrigin = "http://127.0.0.1:3902"
const mcpResource = `${apiOrigin}/mcp`
const protocolVersion = LATEST_PROTOCOL_VERSION

const codeChallenge = (verifier: string) =>
  createHash("sha256").update(verifier).digest("base64url")

const mcpRequest = (body: unknown, headers: Record<string, string> = {}) =>
  new Request(`${apiOrigin}/mcp`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "mcp-protocol-version": protocolVersion,
      ...headers,
    },
    body: JSON.stringify(body),
  })

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  "protected MCP HTTP adapter",
  () => {
    let connection: ReturnType<typeof createDatabase>

    beforeAll(async () => {
      const url = process.env.TEST_DATABASE_URL!
      expect(["localhost", "127.0.0.1", "[::1]"]).toContain(
        new URL(url).hostname,
      )
      vi.stubEnv("DATABASE_URL", url)
      vi.stubEnv("BETTER_AUTH_SECRET", `${randomUUID()}${randomUUID()}`)
      vi.stubEnv("BETTER_AUTH_URL", issuerOrigin)
      vi.stubEnv("FLOWMARK_DASHBOARD_ORIGIN", issuerOrigin)
      vi.stubEnv("FLOWMARK_API_URL", apiOrigin)
      vi.stubEnv("FLOWMARK_AGENT_ACCESS_ENABLED", "true")
      vi.stubEnv("FLOWMARK_DEMO_MODE", "false")
      vi.stubEnv("VERCEL_ENV", "")
      resetMcpRouteCacheForTests()
      connection = createDatabase(url)
      const { getAuth } = await import("../../src/auth.js")
      await Effect.runPromise(getAuth())
    })

    afterAll(async () => {
      await connection?.close()
      resetMcpRouteCacheForTests()
      vi.unstubAllEnvs()
    })

    it("returns disabled responses before agent access is enabled", async () => {
      const previous = process.env.FLOWMARK_AGENT_ACCESS_ENABLED
      process.env.FLOWMARK_AGENT_ACCESS_ENABLED = "false"
      resetMcpRouteCacheForTests()
      const response = await handleMcpPost(
        mcpRequest({ jsonrpc: "2.0", method: "initialize", id: 1 }),
      )
      expect(response.status).toBe(404)
      process.env.FLOWMARK_AGENT_ACCESS_ENABLED = previous
      resetMcpRouteCacheForTests()
    })

    it("rejects non-POST methods with an explicit safe error", async () => {
      const response = await mcpPost(
        new Request(`${apiOrigin}/mcp`, { method: "GET" }),
      )
      expect(response.status).toBe(405)
      expect(response.headers.get("allow")).toBe("POST")
    })

    it("returns 401 for unauthenticated MCP requests", async () => {
      const response = await handleMcpPost(
        mcpRequest({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion,
            capabilities: {},
            clientInfo: { name: "reference", version: "0.1.0" },
          },
        }),
      )
      expect(response.status).toBe(401)
      expect(response.headers.get("www-authenticate")).toBeTruthy()
    })

    it("returns only the granted project scope from get_connection", async () => {
      const { createFlowmarkAuth } = await import("@flowmark/auth")
      const redirectUri = "http://127.0.0.1:4312/callback"
      const clientId = `mcp-http-${randomUUID()}`
      const verifier = randomBytes(32).toString("base64url")
      const auth = createFlowmarkAuth({
        db: connection.db,
        secret: process.env.BETTER_AUTH_SECRET!,
        baseURL: issuerOrigin,
        trustedOrigins: [issuerOrigin, apiOrigin],
        agentAccess: { issuerOrigin, apiOrigin },
      })
      const email = `${randomUUID()}@example.test`
      const password = `${randomUUID()}Aa1`
      const signup = await auth.handler(
        new Request(`${apiOrigin}/api/auth/sign-up/email`, {
          method: "POST",
          headers: {
            origin: issuerOrigin,
            "content-type": "application/json",
          },
          body: JSON.stringify({ name: "MCP HTTP test", email, password }),
        }),
      )
      expect(signup.status).toBe(200)
      const cookie = signup.headers
        .getSetCookie()
        .map((value) => value.split(";")[0])
        .join("; ")
      const session = await auth.api.getSession({ headers: { cookie } })
      assert.ok(session?.user.id)
      await connection.db.insert(oauthClient).values({
        id: randomUUID(),
        clientId,
        name: "MCP HTTP reference client",
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
      })
      await connection.db.insert(oauthClientResource).values({
        id: randomUUID(),
        clientId,
        resourceId: mcpResource,
        createdAt: new Date(),
      })
      const authorize = await auth.handler(
        new Request(
          `${apiOrigin}/api/auth/oauth2/authorize?${new URLSearchParams({
            response_type: "code",
            client_id: clientId,
            redirect_uri: redirectUri,
            scope: "openid profile email offline_access flowmark:read",
            resource: mcpResource,
            code_challenge: codeChallenge(verifier),
            code_challenge_method: "S256",
          })}`,
          { headers: { cookie, origin: issuerOrigin } },
        ),
      )
      const code = new URL(
        authorize.headers.get("location") ?? "",
      ).searchParams.get("code")
      assert.ok(code)
      const tokenResponse = await auth.handler(
        new Request(`${apiOrigin}/api/auth/oauth2/token`, {
          method: "POST",
          headers: {
            origin: issuerOrigin,
            "content-type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            grant_type: "authorization_code",
            client_id: clientId,
            code,
            redirect_uri: redirectUri,
            code_verifier: verifier,
            resource: mcpResource,
          }).toString(),
        }),
      )
      expect(tokenResponse.status).toBe(200)
      const tokens = (await tokenResponse.json()) as {
        access_token: string
      }
      const consentId = randomUUID()
      await connection.db.insert(oauthConsent).values({
        id: consentId,
        clientId,
        userId: session.user.id,
        resources: [mcpResource],
        scopes: [
          "openid",
          "profile",
          "email",
          "offline_access",
          "flowmark:read",
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      const [{ authorizationCodeId }] = await connection.db
        .select({ authorizationCodeId: oauthRefreshToken.authorizationCodeId })
        .from(oauthRefreshToken)
        .where(eq(oauthRefreshToken.clientId, clientId))
      assert.ok(authorizationCodeId)
      const memberUser = session.user.id
      const project = await Effect.runPromise(
        createOwnedProject(memberUser, {
          workspace: "MCP workspace",
          project: "MCP scope project",
        }).pipe(Effect.provideService(Database, connection.db)),
      )
      const projectId = project.projectId
      await Effect.runPromise(
        submitAgentAccessConsent({
          userId: memberUser,
          oauthConsentId: consentId,
          clientId,
          redirectUri,
          requestedScopes: ["offline_access", "flowmark:read"],
          resourceUrl: mcpResource,
          projectIds: [projectId],
        }).pipe(Effect.provideService(Database, connection.db)),
      )

      const authHeaders = {
        authorization: `Bearer ${tokens.access_token}`,
      }
      const initialize = await handleMcpPost(
        mcpRequest(
          {
            jsonrpc: "2.0",
            id: 1,
            method: "initialize",
            params: {
              protocolVersion,
              capabilities: {},
              clientInfo: { name: "reference", version: "0.1.0" },
            },
          },
          authHeaders,
        ),
      )
      expect(initialize.status).toBe(200)
      const initialized = await handleMcpPost(
        mcpRequest(
          { jsonrpc: "2.0", method: "notifications/initialized" },
          authHeaders,
        ),
      )
      expect(initialized.status).toBe(202)
      const listed = await handleMcpPost(
        mcpRequest(
          { jsonrpc: "2.0", id: 2, method: "tools/list" },
          authHeaders,
        ),
      )
      expect(listed.status).toBe(200)
      const tools = (await listed.json()) as {
        result?: { tools?: Array<{ name: string }> }
      }
      expect(tools.result?.tools?.map((tool) => tool.name)).toEqual([
        "get_connection",
      ])
      const connectionResult = await handleMcpPost(
        mcpRequest(
          {
            jsonrpc: "2.0",
            id: 3,
            method: "tools/call",
            params: { name: "get_connection", arguments: {} },
          },
          authHeaders,
        ),
      )
      expect(connectionResult.status).toBe(200)
      const payload = (await connectionResult.json()) as {
        result?: {
          structuredContent?: {
            projects?: Array<{ id: string }>
            toolsEnabled?: string[]
          }
        }
      }
      expect(
        payload.result?.structuredContent?.projects?.map((p) => p.id),
      ).toEqual([projectId])
      expect(payload.result?.structuredContent?.toolsEnabled).toEqual([
        "get_connection",
      ])
      await connection.db
        .delete(verification)
        .where(like(verification.value, `%"userId":"${session.user.id}"%`))
    })
  },
)
