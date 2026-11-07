import { runApi, type McpAgentConnectionSnapshot } from "@flowmark/api"
import { createMcpHandler, McpServer } from "@modelcontextprotocol/server"
import { Exit } from "effect"
import type { FlowmarkMcpAuthInfo } from "../../auth/claims.js"
import type { ResolvedAgentAccessRuntime } from "../../runtime/agent-access-runtime.js"
import { resolveMcpConnection } from "./resolve-connection.js"

const connectionToolResult = (snapshot: McpAgentConnectionSnapshot) => ({
  content: [
    {
      type: "text" as const,
      text: JSON.stringify(snapshot),
    },
  ],
  structuredContent: snapshot,
})

const connectionToolError = (message: string) => ({
  isError: true as const,
  content: [{ type: "text" as const, text: message }],
})

const registerConnectionTool = (
  server: McpServer,
  identity: FlowmarkMcpAuthInfo,
) => {
  server.registerTool(
    "get_connection",
    {
      title: "Get connection",
      description:
        "Return the current OAuth grant, effective project scope, and which investigation tools are enabled on this deployment.",
      inputSchema: {},
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async () => {
      const exit = await runApi(resolveMcpConnection(identity))
      if (Exit.isFailure(exit)) {
        return connectionToolError("Connection details could not be read.")
      }
      return connectionToolResult(exit.value)
    },
  )
}

export const registerFlowmarkTools = (
  server: McpServer,
  identity: FlowmarkMcpAuthInfo,
) => {
  registerConnectionTool(server, identity)
}

export const createFlowmarkMcpSdkHandler = (
  runtime: ResolvedAgentAccessRuntime,
) => {
  let cached: ReturnType<typeof createMcpHandler> | undefined
  return () => {
    if (!cached) {
      cached = createMcpHandler(
        async (ctx) => {
          const identity = ctx.authInfo?.extra as
            FlowmarkMcpAuthInfo | undefined
          if (!identity) {
            throw new Error("Agent access context is missing.")
          }
          const server = new McpServer(
            { name: "flowmark", version: "0.1.0" },
            { capabilities: { tools: {} } },
          )
          registerFlowmarkTools(server, identity)
          return server
        },
        { legacy: "reject" },
      )
    }
    void runtime
    return cached
  }
}
