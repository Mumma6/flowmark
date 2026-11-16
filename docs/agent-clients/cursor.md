# Cursor static OAuth

Cursor can connect to Flowmark MCP over Streamable HTTP. Dynamic client
registration stays closed. Use the pre-registered public client. This document
is the connection contract. It is not a record of a completed Cursor session.

| Item                           | Value                                              |
| ------------------------------ | -------------------------------------------------- |
| Transport                      | Streamable HTTP `POST {apiOrigin}/mcp`             |
| Client id                      | `flowmark-cursor`                                  |
| Client secret                  | None. PKCE S256 is required.                       |
| Scopes                         | `openid`, `offline_access`, `flowmark:read`        |
| Desktop redirect               | `http://localhost:8787/callback`                   |
| Web and Cursor agents redirect | `https://www.cursor.com/agents/mcp/oauth/callback` |

Custom-scheme callbacks such as `cursor://` are not registered and are rejected.

```json
{
  "mcpServers": {
    "flowmark": {
      "url": "https://api.staging.flowmark.dev/mcp",
      "auth": {
        "CLIENT_ID": "flowmark-cursor",
        "scopes": ["openid", "offline_access", "flowmark:read"]
      }
    }
  }
}
```

Use the endpoint Studio Connect shows for the environment you are signed into.
Production is `https://api.flowmark.dev/mcp` after that environment is deployed.
Signing in and selecting projects on `/connect/agent/consent` is what authorizes
evidence. The client id does not.

Revoke the connection in Studio Connect. The next tool call fails even if Cursor
still holds the previous access token.
