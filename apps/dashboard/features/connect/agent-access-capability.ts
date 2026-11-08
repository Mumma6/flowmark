export type RemoteAgentAccessDeployment =
  | {
      readonly kind: "disabled"
      readonly headline: string
      readonly detail: string
    }
  | {
      readonly kind: "unavailable"
      readonly headline: string
      readonly detail: string
    }
  | {
      readonly kind: "enabled"
      readonly mcpUrl: string
    }

const disabled: RemoteAgentAccessDeployment = {
  kind: "disabled",
  headline: "Remote agent read access is not enabled here",
  detail:
    "This deployment does not offer a working MCP endpoint, OAuth consent, connection list, or verified remote read state yet. Use Studio below and copy factual handoff text into the agent you already use.",
}

const unavailable: RemoteAgentAccessDeployment = {
  kind: "unavailable",
  headline: "Remote agent read access could not be confirmed",
  detail:
    "The deployment did not answer with its protected-resource metadata. Retry shortly. Copied instructions are not a connection.",
}

/** The metadata response is the deployment's own capability. A guessed URL is not. */
export const remoteAgentAccessFromProbe = (input: {
  readonly apiOrigin: string
  readonly status: number | null
  readonly resource: string | null
}): RemoteAgentAccessDeployment => {
  if (input.status === 404) {
    return disabled
  }
  const expected = `${input.apiOrigin.replace(/\/$/, "")}/mcp`
  if (input.status === 200 && input.resource === expected) {
    return { kind: "enabled", mcpUrl: expected }
  }
  return unavailable
}
