import { handleAgentConsent } from "../../src/adapters/agent-consent"
import { createHash, randomBytes, randomUUID } from "node:crypto"
import assert from "node:assert/strict"
import { eq, like } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import {
  createDatabase,
  jwks,
  oauthClient,
  oauthClientResource,
  oauthConsent,
  oauthRefreshToken,
  verification,
  workflows,
  workflowRuns,
  workflowEvents,
} from "@flowmark/db"
import {
  createOwnedProject,
  Database,
  submitAgentAccessConsent,
  revokeAgentAccessConnection,
  consumeMcpBudget,
} from "@flowmark/db/persistence"
import { Effect, Result } from "effect"
import {
  studioRunSelection,
  runSelectionToolInput,
} from "../../../dashboard/features/runs/investigation-selection"
import { appRouter } from "../../src/adapters/trpc"
import { LATEST_PROTOCOL_VERSION } from "@flowmark/mcp"
import { POST as mcpPost } from "../../app/mcp/route"
import {
  handleMcpPost,
  resetMcpRouteCacheForTests,
} from "../../src/adapters/mcp/route"

const testOrigin = "http://127.0.0.1:3902"
const mcpResource = `${testOrigin}/mcp`
const protocolVersion = LATEST_PROTOCOL_VERSION

const codeChallenge = (verifier: string) =>
  createHash("sha256").update(verifier).digest("base64url")

const mcpRequest = (body: unknown, headers: Record<string, string> = {}) =>
  new Request(`${testOrigin}/mcp`, {
    method: "POST",
    headers: {
      accept: "application/json, text/event-stream",
      "content-type": "application/json",
      "mcp-protocol-version": protocolVersion,
      ...headers,
    },
    body: JSON.stringify(body),
  })

const readMcpJsonBody = async <T>(response: Response): Promise<T> => {
  const contentType = response.headers.get("content-type") ?? ""
  if (contentType.includes("application/json")) {
    return (await response.json()) as T
  }
  const text = await response.text()
  const dataLine = text
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.startsWith("data:"))
  if (!dataLine) {
    throw new Error(`Expected MCP JSON in response: ${text}`)
  }
  return JSON.parse(dataLine.slice("data:".length).trim()) as T
}

const mcpSessionHeaders = (
  authHeaders: Record<string, string>,
  sessionResponse: Response,
) => {
  const sessionId = sessionResponse.headers.get("mcp-session-id")
  return {
    ...authHeaders,
    ...(sessionId ? { "mcp-session-id": sessionId } : {}),
  }
}

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
      vi.stubEnv("BETTER_AUTH_URL", testOrigin)
      vi.stubEnv("FLOWMARK_DASHBOARD_ORIGIN", testOrigin)
      vi.stubEnv("FLOWMARK_API_URL", testOrigin)
      vi.stubEnv("FLOWMARK_AGENT_ACCESS_ENABLED", "true")
      vi.stubEnv("FLOWMARK_DEMO_MODE", "false")
      vi.stubEnv("VERCEL_ENV", "")
      const { getAuth, resetAuthCacheForTests } =
        await import("../../src/auth.js")
      resetAuthCacheForTests()
      resetMcpRouteCacheForTests()
      connection = createDatabase(url)
      await connection.db.delete(jwks)
      await Effect.runPromise(getAuth())
      const nativeFetch = globalThis.fetch
      const issuerApiPath = (pathname: string) => {
        if (pathname === "/jwks") {
          return "/api/auth/jwks"
        }
        if (pathname.startsWith("/.well-known/")) {
          return `/api/auth${pathname}`
        }
        if (pathname.startsWith("/oauth2/")) {
          return `/api/auth${pathname}`
        }
        return undefined
      }
      vi.stubGlobal(
        "fetch",
        async (input: RequestInfo | URL, init?: RequestInit) => {
          const href =
            typeof input === "string"
              ? input
              : input instanceof URL
                ? input.href
                : input.url
          const url = new URL(href)
          const routed = issuerApiPath(url.pathname)
          if (url.origin === testOrigin && routed) {
            const auth = await Effect.runPromise(getAuth())
            return auth.handler(
              new Request(`${url.origin}${routed}${url.search}`, init),
            )
          }
          return nativeFetch(input, init)
        },
      )
    })

    afterAll(async () => {
      await connection?.close()
      const { resetAuthCacheForTests } = await import("../../src/auth.js")
      resetAuthCacheForTests()
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
      const consent = await handleAgentConsent(
        new Request(`${testOrigin}/v1/agent-consent`),
      )
      expect(consent.status).toBe(404)
      process.env.FLOWMARK_AGENT_ACCESS_ENABLED = previous
      resetMcpRouteCacheForTests()
    })

    it("rejects non-POST methods with an explicit safe error", async () => {
      const response = await mcpPost(
        new Request(`${testOrigin}/mcp`, { method: "GET" }),
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
      const { getAuth } = await import("../../src/auth.js")
      const redirectUri = "http://127.0.0.1:4312/callback"
      const clientId = `mcp-http-${randomUUID()}`
      const auth = await Effect.runPromise(getAuth())
      const email = `${randomUUID()}@example.test`
      const password = `${randomUUID()}Aa1`
      const signup = await auth.handler(
        new Request(`${testOrigin}/api/auth/sign-up/email`, {
          method: "POST",
          headers: {
            origin: testOrigin,
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
      const issueToken = async () => {
        const verifier = randomBytes(32).toString("base64url")
        const authorize = await auth.handler(
          new Request(
            `${testOrigin}/api/auth/oauth2/authorize?${new URLSearchParams({
              response_type: "code",
              client_id: clientId,
              redirect_uri: redirectUri,
              scope: "openid profile email offline_access flowmark:read",
              resource: mcpResource,
              code_challenge: codeChallenge(verifier),
              code_challenge_method: "S256",
            })}`,
            { headers: { cookie, origin: testOrigin } },
          ),
        )
        const code = new URL(
          authorize.headers.get("location") ?? "",
        ).searchParams.get("code")
        assert.ok(code)
        const tokenResponse = await auth.handler(
          new Request(`${testOrigin}/api/auth/oauth2/token`, {
            method: "POST",
            headers: {
              origin: testOrigin,
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
        return (await tokenResponse.json()) as {
          access_token: string
          refresh_token: string
        }
      }
      const tokens = await issueToken()
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
          requestedScopes: [
            "openid",
            "profile",
            "email",
            "offline_access",
            "flowmark:read",
          ],
          resourceUrl: mcpResource,
          projectIds: [projectId],
        }).pipe(Effect.provideService(Database, connection.db)),
      )

      const workflowId = randomUUID()
      const selectedRunId = randomUUID()
      await connection.db
        .insert(workflows)
        .values({ id: workflowId, projectId, name: "selection.proof" })
      await connection.db.insert(workflowRuns).values({
        id: selectedRunId,
        workflowId,
        externalId: "synthetic-selection-proof",
        startedAt: new Date("2026-11-02T00:00:00.000Z"),
      })
      await connection.db.insert(workflowEvents).values([
        {
          eventId: randomUUID(),
          runId: selectedRunId,
          type: "started",
          occurredAt: new Date("2026-11-02T00:00:00.000Z"),
        },
        {
          eventId: randomUUID(),
          runId: selectedRunId,
          type: "completed",
          occurredAt: new Date("2026-11-02T00:00:01.000Z"),
          durationMs: 1000,
        },
      ])
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
      const sessionHeaders = mcpSessionHeaders(authHeaders, initialize)
      const initialized = await handleMcpPost(
        mcpRequest(
          { jsonrpc: "2.0", method: "notifications/initialized" },
          sessionHeaders,
        ),
      )
      expect(initialized.status).toBe(202)
      const listed = await handleMcpPost(
        mcpRequest(
          { jsonrpc: "2.0", id: 2, method: "tools/list" },
          sessionHeaders,
        ),
      )
      expect(listed.status).toBe(200)
      const tools = await readMcpJsonBody<{
        result?: { tools?: Array<{ name: string }> }
      }>(listed)
      expect(
        [...(tools.result?.tools?.map((tool) => tool.name) ?? [])].sort(),
      ).toEqual(
        [
          "compare_run",
          "find_runs",
          "get_connection",
          "get_run",
          "get_workflow_insights",
          "list_workflows",
        ].sort(),
      )
      const connectionResult = await handleMcpPost(
        mcpRequest(
          {
            jsonrpc: "2.0",
            id: 3,
            method: "tools/call",
            params: { name: "get_connection", arguments: {} },
          },
          sessionHeaders,
        ),
      )
      expect(connectionResult.status).toBe(200)
      const payload = await readMcpJsonBody<{
        result?: {
          structuredContent?: {
            projects?: Array<{ id: string }>
            toolsEnabled?: string[]
          }
        }
      }>(connectionResult)
      expect(
        payload.result?.structuredContent?.projects?.map((p) => p.id),
      ).toEqual([projectId])
      expect(payload.result?.structuredContent?.toolsEnabled).toEqual([
        "get_connection",
        "list_workflows",
        "find_runs",
        "get_run",
        "compare_run",
        "get_workflow_insights",
      ])
      const selection = Result.getOrThrow(
        studioRunSelection(projectId, selectedRunId),
      )
      const selectionInput = Result.getOrThrow(
        runSelectionToolInput(JSON.parse(JSON.stringify(selection))),
      )
      const selectedRead = await readMcpJsonBody<{
        result?: {
          isError?: boolean
          structuredContent?: { summary: unknown; page: unknown }
        }
      }>(
        await handleMcpPost(
          mcpRequest(
            {
              jsonrpc: "2.0",
              id: 30,
              method: "tools/call",
              params: { name: "get_run", arguments: selectionInput },
            },
            sessionHeaders,
          ),
        ),
      )
      expect(selectedRead.result?.isError).toBeUndefined()
      const studio = appRouter.createCaller({
        request: new Request(`${testOrigin}/api/trpc`, {
          headers: { cookie, "x-flowmark-project-id": projectId },
        }),
      })
      expect(selectedRead.result?.structuredContent?.summary).toEqual(
        await studio.run.investigationSummary({ id: selectedRunId }),
      )
      expect(selectedRead.result?.structuredContent?.page).toEqual(
        await studio.run.eventPage({ runId: selectedRunId }),
      )
      const discovery = await readMcpJsonBody<{
        result?: { isError?: boolean }
      }>(
        await handleMcpPost(
          mcpRequest(
            {
              jsonrpc: "2.0",
              id: 31,
              method: "tools/call",
              params: { name: "list_workflows", arguments: { projectId } },
            },
            sessionHeaders,
          ),
        ),
      )
      expect(discovery.result?.isError).toBeUndefined()
      const found = await readMcpJsonBody<{ result?: { isError?: boolean } }>(
        await handleMcpPost(
          mcpRequest(
            {
              jsonrpc: "2.0",
              id: 32,
              method: "tools/call",
              params: {
                name: "find_runs",
                arguments: {
                  projectId,
                  startedAfter: "2026-11-01T00:00:00.000Z",
                  startedBefore: "2026-11-08T00:00:00.000Z",
                },
              },
            },
            sessionHeaders,
          ),
        ),
      )
      expect(found.result?.isError).toBeUndefined()
      const foreignRunId = randomUUID()
      const missingRun = await handleMcpPost(
        mcpRequest(
          {
            jsonrpc: "2.0",
            id: 4,
            method: "tools/call",
            params: {
              name: "get_run",
              arguments: { projectId, runId: foreignRunId },
            },
          },
          sessionHeaders,
        ),
      )
      expect(missingRun.status).toBe(200)
      const missingRunBody = await readMcpJsonBody<{
        result?: { isError?: boolean; content?: Array<{ text?: string }> }
      }>(missingRun)
      expect(missingRunBody.result?.isError).toBe(true)
      expect(missingRunBody.result?.content?.[0]?.text).toContain(
        "Run not found",
      )
      const compared = await handleMcpPost(
        mcpRequest(
          {
            jsonrpc: "2.0",
            id: 5,
            method: "tools/call",
            params: {
              name: "compare_run",
              arguments: { projectId, runId: foreignRunId },
            },
          },
          sessionHeaders,
        ),
      )
      expect(compared.status).toBe(200)
      const comparedBody = await readMcpJsonBody<{
        result?: {
          isError?: boolean
          structuredContent?: { tool?: string; selection?: unknown }
        }
      }>(compared)
      expect(comparedBody.result?.isError).toBeUndefined()
      expect(comparedBody.result?.structuredContent?.tool).toBe("compare_run")
      expect(comparedBody.result?.structuredContent?.selection).toBeNull()
      const invalidPeers = await handleMcpPost(
        mcpRequest(
          {
            jsonrpc: "2.0",
            id: 6,
            method: "tools/call",
            params: {
              name: "compare_run",
              arguments: {
                projectId,
                runId: foreignRunId,
                peers: { days: 91 },
              },
            },
          },
          sessionHeaders,
        ),
      )
      const invalidPeersBody = await readMcpJsonBody<{
        result?: { isError?: boolean }
      }>(invalidPeers)
      expect(invalidPeersBody.result?.isError).toBe(true)
      const insightWindows = {
        currentStartedAfter: "2026-11-01T00:00:00.000Z",
        currentStartedBefore: "2026-11-08T00:00:00.000Z",
        previousStartedAfter: "2026-10-25T00:00:00.000Z",
        previousStartedBefore: "2026-11-01T00:00:00.000Z",
      }
      const insights = await handleMcpPost(
        mcpRequest(
          {
            jsonrpc: "2.0",
            id: 7,
            method: "tools/call",
            params: {
              name: "get_workflow_insights",
              arguments: {
                projectId,
                mode: "technical",
                ...insightWindows,
              },
            },
          },
          sessionHeaders,
        ),
      )
      expect(insights.status).toBe(200)
      const insightsBody = await readMcpJsonBody<{
        result?: {
          isError?: boolean
          structuredContent?: {
            mode?: string
            selection?: { currentStartedAfter?: string }
          }
        }
      }>(insights)
      expect(insightsBody.result?.isError).toBeUndefined()
      expect(insightsBody.result?.structuredContent?.mode).toBe("technical")
      expect(
        insightsBody.result?.structuredContent?.selection?.currentStartedAfter,
      ).toBe(insightWindows.currentStartedAfter)
      const mixedInsights = await handleMcpPost(
        mcpRequest(
          {
            jsonrpc: "2.0",
            id: 8,
            method: "tools/call",
            params: {
              name: "get_workflow_insights",
              arguments: {
                projectId,
                mode: "technical",
                revision: "booked",
                ...insightWindows,
              },
            },
          },
          sessionHeaders,
        ),
      )
      const mixedInsightsBody = await readMcpJsonBody<{
        result?: { isError?: boolean }
      }>(mixedInsights)
      expect(mixedInsightsBody.result?.isError).toBe(true)
      const callConnection = async (headers: Record<string, string>) =>
        readMcpJsonBody<{
          result?: {
            isError?: boolean
            structuredContent?: { projects?: Array<{ id: string }> }
          }
        }>(
          await handleMcpPost(
            mcpRequest(
              {
                jsonrpc: "2.0",
                id: 9,
                method: "tools/call",
                params: { name: "get_connection", arguments: {} },
              },
              headers,
            ),
          ),
        )
      await Promise.all(
        Array.from({ length: 120 }, () =>
          Effect.runPromise(
            consumeMcpBudget(`grant:${authorizationCodeId}`, 120).pipe(
              Effect.provideService(Database, connection.db),
            ),
          ),
        ),
      )
      const exhausted = await callConnection(sessionHeaders)
      expect(exhausted.result?.isError).toBe(true)
      // Revocation must still succeed after the read budget is exhausted.
      await Effect.runPromise(
        revokeAgentAccessConnection({
          userId: memberUser,
          clientId,
          authorizationCodeId,
        }).pipe(Effect.provideService(Database, connection.db)),
      )
      expect((await callConnection(sessionHeaders)).result?.isError).toBe(true)

      const reconnected = await issueToken()
      const nextProject = await Effect.runPromise(
        createOwnedProject(memberUser, {
          workspace: "Reconnected workspace",
          project: "Reconnected scope",
        }).pipe(Effect.provideService(Database, connection.db)),
      )
      await Effect.runPromise(
        submitAgentAccessConsent({
          userId: memberUser,
          oauthConsentId: consentId,
          clientId,
          redirectUri,
          requestedScopes: [
            "openid",
            "profile",
            "email",
            "offline_access",
            "flowmark:read",
          ],
          resourceUrl: mcpResource,
          projectIds: [nextProject.projectId],
        }).pipe(Effect.provideService(Database, connection.db)),
      )
      // A still-signed old JWT must never inherit the replacement family's projects.
      expect((await callConnection(sessionHeaders)).result?.isError).toBe(true)
      const newHeaders = { authorization: `Bearer ${reconnected.access_token}` }
      const newSession = await handleMcpPost(
        mcpRequest(
          {
            jsonrpc: "2.0",
            id: 10,
            method: "initialize",
            params: {
              protocolVersion,
              capabilities: {},
              clientInfo: { name: "reconnected", version: "0.1.0" },
            },
          },
          newHeaders,
        ),
      )
      expect(newSession.status).toBe(200)
      const replacementHeaders = mcpSessionHeaders(newHeaders, newSession)
      await handleMcpPost(
        mcpRequest(
          { jsonrpc: "2.0", method: "notifications/initialized" },
          replacementHeaders,
        ),
      )
      const replacement = await callConnection(replacementHeaders)
      expect(replacement.result?.isError).toBeUndefined()
      expect(
        replacement.result?.structuredContent?.projects?.map(
          (project) => project.id,
        ),
      ).toEqual([nextProject.projectId])
      await connection.db
        .delete(verification)
        .where(like(verification.value, `%"userId":"${session.user.id}"%`))
    })
    it("binds real signed provider consent to the selected account and projects before code exchange", async () => {
      const { getAuth } = await import("../../src/auth.js")
      const auth = await Effect.runPromise(getAuth())
      const signup = async () => {
        const response = await auth.handler(
          new Request(`${testOrigin}/api/auth/sign-up/email`, {
            method: "POST",
            headers: { origin: testOrigin, "content-type": "application/json" },
            body: JSON.stringify({
              name: "Consent test",
              email: `${randomUUID()}@example.test`,
              password: `${randomUUID()}Aa1`,
            }),
          }),
        )
        expect(response.status).toBe(200)
        const cookie = response.headers
          .getSetCookie()
          .map((value) => value.split(";")[0])
          .join("; ")
        const session = await auth.api.getSession({ headers: { cookie } })
        assert.ok(session)
        return { cookie, session }
      }
      const account = await signup()
      const foreign = await signup()
      const clientId = `consent-${randomUUID()}`
      const redirectUri = "http://127.0.0.1:4312/callback"
      const scopes = ["openid", "offline_access", "flowmark:read"]
      await connection.db.insert(oauthClient).values({
        id: randomUUID(),
        clientId,
        name: "Untrusted <script> client",
        redirectUris: [redirectUri],
        grantTypes: ["authorization_code", "refresh_token"],
        responseTypes: ["code"],
        tokenEndpointAuthMethod: "none",
        applicationType: "native",
        requirePKCE: true,
        skipConsent: false,
        disabled: false,
        scopes,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      await connection.db.insert(oauthClientResource).values({
        id: randomUUID(),
        clientId,
        resourceId: mcpResource,
        createdAt: new Date(),
      })
      const createProject = (name: string) =>
        Effect.runPromise(
          createOwnedProject(account.session.user.id, {
            workspace: name,
            project: name,
          }).pipe(Effect.provideService(Database, connection.db)),
        )
      const selected = await createProject("Selected consent project")
      const excluded = await createProject("Excluded consent project")
      const verifier = randomBytes(32).toString("base64url")
      const authorization = await auth.handler(
        new Request(
          `${testOrigin}/api/auth/oauth2/authorize?${new URLSearchParams({
            response_type: "code",
            client_id: clientId,
            redirect_uri: redirectUri,
            scope: scopes.join(" "),
            resource: mcpResource,
            code_challenge: codeChallenge(verifier),
            code_challenge_method: "S256",
          })}`,
          { headers: { cookie: account.cookie, origin: testOrigin } },
        ),
      )
      const consentLocation = new URL(
        authorization.headers.get("location") ?? "",
        testOrigin,
      )
      expect(consentLocation.pathname).toBe("/connect/agent/consent")
      const oauthQuery = consentLocation.search.slice(1)
      const view = await handleAgentConsent(
        new Request(
          `${testOrigin}/v1/agent-consent?${new URLSearchParams({ oauth_query: oauthQuery })}`,
          { headers: { cookie: account.cookie } },
        ),
      )
      expect(view.status).toBe(200)
      expect(view.headers.get("cache-control")).toBe("no-store")
      const metadata = (await view.json()) as {
        accountBinding: string
        account: { id: string }
        projects: Array<{ id: string }>
      }
      expect(metadata.account.id).toBe(account.session.user.id)
      expect(metadata.projects.map((project) => project.id)).toContain(
        selected.projectId,
      )
      const submit = (
        cookie: string,
        projectIds: string[],
        accept = true,
        query = oauthQuery,
      ) =>
        handleAgentConsent(
          new Request(`${testOrigin}/v1/agent-consent`, {
            method: "POST",
            headers: {
              cookie,
              origin: testOrigin,
              "content-type": "application/json",
            },
            body: JSON.stringify({
              oauthQuery: query,
              accountBinding: metadata.accountBinding,
              accept,
              projectIds,
            }),
          }),
        )
      expect((await submit(account.cookie, [])).status).toBe(400)
      expect((await submit(foreign.cookie, [selected.projectId])).status).toBe(
        400,
      )
      expect((await submit(account.cookie, [randomUUID()])).status).toBe(400)
      expect(
        (
          await submit(
            account.cookie,
            [selected.projectId],
            true,
            oauthQuery.replace(clientId, "substituted"),
          )
        ).status,
      ).toBe(400)
      const denial = await submit(account.cookie, [], false)
      expect(denial.status).toBe(200)
      expect(
        new URL(
          ((await denial.json()) as { redirect: string }).redirect,
        ).searchParams.get("error"),
      ).toBe("access_denied")
      const accepted = await submit(account.cookie, [selected.projectId])
      expect(accepted.status).toBe(200)
      const callback = new URL(
        ((await accepted.json()) as { redirect: string }).redirect,
      )
      const code = callback.searchParams.get("code")
      assert.ok(code)
      const exchanged = await auth.handler(
        new Request(`${testOrigin}/api/auth/oauth2/token`, {
          method: "POST",
          headers: {
            origin: testOrigin,
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
      expect(exchanged.status).toBe(200)
      const tokens = (await exchanged.json()) as { access_token: string }
      const { readAgentAccessGrantFamily } =
        await import("@flowmark/auth/agent-access")
      const claims = JSON.parse(
        Buffer.from(tokens.access_token.split(".")[1], "base64url").toString(),
      ) as { flowmark_grant_family: string }
      const family = await Effect.runPromise(
        readAgentAccessGrantFamily(connection.db, {
          subjectUserId: account.session.user.id,
          clientId,
          issuer: testOrigin,
          resource: mcpResource,
          authorizationCodeId: claims.flowmark_grant_family,
        }),
      )
      const { getDelegatedReaderProject } =
        await import("@flowmark/db/persistence")
      const reader = (projectId: string) =>
        Effect.runPromise(
          getDelegatedReaderProject({
            userId: account.session.user.id,
            clientId,
            authorizationCodeId: family.familyId,
            projectId,
          }).pipe(Effect.provideService(Database, connection.db)),
        )
      expect(await reader(selected.projectId)).toBe(selected.projectId)
      expect(await reader(excluded.projectId)).toBeUndefined()
      const nextAuthorization = await auth.handler(
        new Request(
          `${testOrigin}/api/auth/oauth2/authorize?${new URLSearchParams({ response_type: "code", client_id: clientId, redirect_uri: redirectUri, scope: scopes.join(" "), resource: mcpResource, code_challenge: codeChallenge(verifier), code_challenge_method: "S256", prompt: "consent" })}`,
          { headers: { cookie: account.cookie, origin: testOrigin } },
        ),
      )
      const nextQuery = new URL(
        nextAuthorization.headers.get("location")!,
        testOrigin,
      ).search.slice(1)
      const nextView = await handleAgentConsent(
        new Request(
          `${testOrigin}/v1/agent-consent?${new URLSearchParams({ oauth_query: nextQuery })}`,
          { headers: { cookie: account.cookie } },
        ),
      )
      expect(nextView.status).toBe(200)
      const nextMetadata = (await nextView.json()) as { accountBinding: string }
      const replacement = await handleAgentConsent(
        new Request(`${testOrigin}/v1/agent-consent`, {
          method: "POST",
          headers: {
            cookie: account.cookie,
            origin: testOrigin,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            oauthQuery: nextQuery,
            accountBinding: nextMetadata.accountBinding,
            accept: true,
            projectIds: [excluded.projectId],
          }),
        }),
      )
      expect(replacement.status).toBe(200)
      expect(await reader(selected.projectId)).toBeUndefined()
      const nextCode = new URL(
        ((await replacement.json()) as { redirect: string }).redirect,
      ).searchParams.get("code")!
      const nextExchange = await auth.handler(
        new Request(`${testOrigin}/api/auth/oauth2/token`, {
          method: "POST",
          headers: {
            origin: testOrigin,
            "content-type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            grant_type: "authorization_code",
            client_id: clientId,
            code: nextCode,
            redirect_uri: redirectUri,
            code_verifier: verifier,
            resource: mcpResource,
          }).toString(),
        }),
      )
      expect(nextExchange.status).toBe(200)
      const nextTokens = (await nextExchange.json()) as { access_token: string }
      const nextClaims = JSON.parse(
        Buffer.from(
          nextTokens.access_token.split(".")[1],
          "base64url",
        ).toString(),
      ) as { flowmark_grant_family: string }
      const nextReader = (projectId: string) =>
        Effect.runPromise(
          getDelegatedReaderProject({
            userId: account.session.user.id,
            clientId,
            authorizationCodeId: nextClaims.flowmark_grant_family,
            projectId,
          }).pipe(Effect.provideService(Database, connection.db)),
        )
      expect(await nextReader(excluded.projectId)).toBe(excluded.projectId)
      expect(await nextReader(selected.projectId)).toBeUndefined()
    })
  },
)
