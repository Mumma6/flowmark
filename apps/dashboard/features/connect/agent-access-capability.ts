/** Remote MCP/OAuth is off until the connected increment ships (TASK-005+). */
export type RemoteAgentAccessDeployment =
  | {
      readonly kind: "disabled"
      readonly headline: string
      readonly detail: string
    }
  | {
      readonly kind: "enabled"
      readonly mcpUrl: string
    }

export function remoteAgentAccessDeployment(
  apiOrigin: string,
): RemoteAgentAccessDeployment {
  void apiOrigin
  return {
    kind: "disabled",
    headline: "Remote agent read access is not enabled here",
    detail:
      "This deployment does not offer a working MCP endpoint, OAuth consent, connection list, or verified remote read state yet. Use Studio below and copy factual handoff text into the agent you already use.",
  }
}
