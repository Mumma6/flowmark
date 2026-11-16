/** Must match `CURSOR_MCP_PUBLIC_CLIENT` in `@flowmark/auth`. */
export const cursorMcpClientId = "flowmark-cursor"

export const cursorMcpRedirectUris = [
  "http://localhost:8787/callback",
  "https://www.cursor.com/agents/mcp/oauth/callback",
] as const

export function cursorMcpConfig(mcpUrl: string): string {
  return JSON.stringify(
    {
      mcpServers: {
        flowmark: {
          url: mcpUrl,
          auth: {
            CLIENT_ID: cursorMcpClientId,
            scopes: ["openid", "offline_access", "flowmark:read"],
          },
        },
      },
    },
    null,
    2,
  )
}
