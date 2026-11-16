export type RemoteAgentAccessDeployment =
  | {
      readonly kind: "unavailable"
      readonly headline: string
      readonly detail: string
    }
  | {
      readonly kind: "enabled"
      readonly mcpUrl: string
    }

const unavailable: RemoteAgentAccessDeployment = {
  kind: "unavailable",
  headline: "Remote MCP metadata could not be confirmed",
  detail:
    "This deployment did not return its protected-resource metadata. Retry the check. OAuth and an explicit project grant are still required before any evidence is readable. Copied instructions are not a connection.",
}

/** The metadata response is the deployment's own capability. A guessed URL is not. */
export const remoteAgentAccessFromProbe = (input: {
  readonly apiOrigin: string
  readonly status: number | null
  readonly resource: string | null
}): RemoteAgentAccessDeployment => {
  const expected = `${input.apiOrigin.replace(/\/$/, "")}/mcp`
  if (input.status === 200 && input.resource === expected) {
    return { kind: "enabled", mcpUrl: expected }
  }
  return unavailable
}
