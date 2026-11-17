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
  headline: "Cursor connection could not be confirmed",
  detail:
    "Flowmark could not check the connection endpoint for this environment. Retry in a moment. If it still fails, check that the API is reachable.",
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
