import { AGENT_ACCESS_OAUTH_SCOPE_READ } from "@flowmark/auth/agent-access"
import { Option } from "effect"
import type { ResolvedAgentAccessRuntime } from "../runtime/agent-access-runtime.js"
import type { AuthInfo } from "@modelcontextprotocol/server"

type AccessClaims = {
  readonly sub?: unknown
  readonly client_id?: unknown
  readonly azp?: unknown
  readonly exp?: unknown
  readonly flowmark_grant_family?: unknown
}

const nonEmptyString = (value: unknown) =>
  typeof value === "string" && value.trim().length > 0
    ? Option.some(value.trim())
    : Option.none()

const oauthClientIdFromClaims = (claims: AccessClaims) =>
  Option.firstSomeOf([
    nonEmptyString(claims.client_id),
    nonEmptyString(claims.azp),
  ])

export type FlowmarkMcpAuthInfo = {
  readonly subjectUserId: string
  readonly authorizationCodeId: string
  readonly clientId: string
  readonly resourceUrl: string
  readonly issuer: string
}

export const authInfoFromClaims = (
  runtime: ResolvedAgentAccessRuntime,
  claims: AccessClaims,
): FlowmarkMcpAuthInfo | undefined => {
  return Option.all({
    subjectUserId: nonEmptyString(claims.sub),
    authorizationCodeId: nonEmptyString(claims.flowmark_grant_family),
    clientId: oauthClientIdFromClaims(claims),
  }).pipe(
    Option.map((identity) => ({
      ...identity,
      resourceUrl: runtime.mcpResourceUrl,
      issuer: runtime.issuerOrigin,
    })),
    Option.getOrUndefined,
  )
}

export const toMcpAuthInfo = (
  identity: FlowmarkMcpAuthInfo,
  claims: AccessClaims,
  token: string,
): AuthInfo => ({
  token,
  clientId: identity.clientId,
  scopes: [AGENT_ACCESS_OAUTH_SCOPE_READ],
  expiresAt: Option.getOrUndefined(
    typeof claims.exp === "number" ? Option.some(claims.exp) : Option.none(),
  ),
  extra: identity,
})
