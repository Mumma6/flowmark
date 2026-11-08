import { createHmac, timingSafeEqual } from "node:crypto"
import { verifyOAuthQueryParams } from "@better-auth/oauth-provider"
import { Array, Effect } from "effect"
import { AgentAccessContractError } from "./contract-errors.js"

/** Provider-supported signature verification, before any client metadata is displayed. */
export const verifyAgentConsentRequest = Effect.fn(
  "AgentAccess.verifyConsentRequest",
)(function* (oauthQuery: string, secret: string, resourceUrl: string) {
  if (!oauthQuery || oauthQuery.length > 8192) {
    return yield* new AgentAccessContractError({
      reason: "Invalid authorization request. Restart from your client.",
    })
  }
  const valid = yield* Effect.tryPromise({
    try: () => verifyOAuthQueryParams(oauthQuery, secret),
    catch: (cause) =>
      new AgentAccessContractError({
        reason: "Authorization verification is unavailable.",
        cause,
      }),
  })
  if (!valid) {
    return yield* new AgentAccessContractError({
      reason:
        "This authorization request expired or was changed. Restart from your client.",
    })
  }
  const query = new URLSearchParams(oauthQuery)
  const clientId = query.get("client_id")
  const redirectUri = query.get("redirect_uri")
  const scopes = Array.filter(
    query.get("scope")?.split(" ") ?? [],
    (scope) => scope.length > 0,
  )
  const resources = query.getAll("resource")
  if (
    !clientId ||
    !redirectUri ||
    query.getAll("client_id").length !== 1 ||
    query.getAll("redirect_uri").length !== 1 ||
    query.getAll("scope").length !== 1 ||
    resources.length !== 1 ||
    resources[0] !== resourceUrl ||
    !scopes.includes("flowmark:read") ||
    !Array.every(scopes, (scope) =>
      [
        "openid",
        "profile",
        "email",
        "offline_access",
        "flowmark:read",
      ].includes(scope),
    )
  ) {
    return yield* new AgentAccessContractError({
      reason: "This authorization request is not supported by this deployment.",
    })
  }
  return { oauthQuery, clientId, redirectUri, scopes }
})

export const agentConsentAccountBinding = (
  oauthQuery: string,
  userId: string,
  sessionId: string,
  secret: string,
) =>
  createHmac("sha256", secret)
    .update(
      JSON.stringify(["flowmark-consent-v1", oauthQuery, userId, sessionId]),
    )
    .digest("hex")

export const verifyAgentConsentAccountBinding = (
  binding: string,
  oauthQuery: string,
  userId: string,
  sessionId: string,
  secret: string,
) =>
  /^[a-f0-9]{64}$/.test(binding) &&
  timingSafeEqual(
    Buffer.from(binding, "hex"),
    Buffer.from(
      agentConsentAccountBinding(oauthQuery, userId, sessionId, secret),
      "hex",
    ),
  )
