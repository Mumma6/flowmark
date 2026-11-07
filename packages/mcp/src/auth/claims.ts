import { AGENT_ACCESS_OAUTH_SCOPE_READ } from "@flowmark/auth/agent-access"
import type { ResolvedAgentAccessRuntime } from "../runtime/agent-access-runtime.js"
import type { AuthInfo } from "@modelcontextprotocol/server"

type AccessClaims = {
  readonly sub?: unknown
  readonly client_id?: unknown
  readonly azp?: unknown
  readonly exp?: unknown
}

const oauthClientIdFromClaims = (claims: AccessClaims) => {
  const direct = claims.client_id
  if (typeof direct === "string" && direct.trim().length > 0) {
    return direct.trim()
  }
  const azp = claims.azp
  if (typeof azp === "string" && azp.trim().length > 0) {
    return azp.trim()
  }
  return undefined
}

export type FlowmarkMcpAuthInfo = {
  readonly subjectUserId: string
  readonly clientId: string
  readonly resourceUrl: string
  readonly issuer: string
}

export const authInfoFromClaims = (
  runtime: ResolvedAgentAccessRuntime,
  claims: AccessClaims,
): FlowmarkMcpAuthInfo | undefined => {
  const subjectUserId = claims.sub
  const clientId = oauthClientIdFromClaims(claims)
  if (typeof subjectUserId !== "string" || !clientId) {
    return undefined
  }
  return {
    subjectUserId,
    clientId,
    resourceUrl: runtime.mcpResourceUrl,
    issuer: runtime.issuerOrigin,
  }
}

export const toMcpAuthInfo = (
  identity: FlowmarkMcpAuthInfo,
  claims: AccessClaims,
  token: string,
): AuthInfo => ({
  token,
  clientId: identity.clientId,
  scopes: [AGENT_ACCESS_OAUTH_SCOPE_READ],
  expiresAt: typeof claims.exp === "number" ? claims.exp : undefined,
  extra: identity,
})
