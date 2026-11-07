import { runApi, type McpAgentConnectionSnapshot } from "@flowmark/api"
import {
  createMcpHandler,
  fromJsonSchema,
  McpServer,
} from "@modelcontextprotocol/server"
import { Cause, Exit } from "effect"
import type { FlowmarkMcpAuthInfo } from "../../auth/claims.js"
import type { ResolvedAgentAccessRuntime } from "../../runtime/agent-access-runtime.js"
import { findRunsForMcp } from "../workflows/find-runs.js"
import { listWorkflowsForMcp } from "../workflows/list-workflows.js"
import {
  mapWorkflowReadFailure,
  mcpToolError,
  mcpToolResult,
} from "../../tools/response.js"
import {
  findRunsInputJsonSchema,
  listWorkflowsInputJsonSchema,
} from "../../tools/tool-input-json-schema.js"
import { resolveMcpConnection } from "./resolve-connection.js"

const connectionToolResult = (snapshot: McpAgentConnectionSnapshot) =>
  mcpToolResult(snapshot)

const failureFromCause = (cause: Cause.Cause<unknown>) => {
  const failed = cause.reasons.find(Cause.isFailReason)
  return failed?.error ?? cause
}

const runMcpTool = async (effect: Parameters<typeof runApi>[0]) => {
  const exit = await runApi(effect)
  return Exit.match(exit, {
    onSuccess: (value) => mcpToolResult(value as Record<string, unknown>),
    onFailure: (cause) => mapWorkflowReadFailure(failureFromCause(cause)),
  })
}

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
        return mcpToolError("Connection details could not be read.")
      }
      return connectionToolResult(exit.value)
    },
  )
}

const registerListWorkflowsTool = (
  server: McpServer,
  identity: FlowmarkMcpAuthInfo,
) => {
  server.registerTool(
    "list_workflows",
    {
      title: "List workflows",
      description:
        "List workflow names in an authorized project. Optionally pass workflow (and revision) to load bounded declaration, search-field and lookup meaning without any write access.",
      inputSchema: fromJsonSchema(listWorkflowsInputJsonSchema),
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async (input: unknown) => runMcpTool(listWorkflowsForMcp(identity, input)),
  )
}

const registerFindRunsTool = (
  server: McpServer,
  identity: FlowmarkMcpAuthInfo,
) => {
  server.registerTool(
    "find_runs",
    {
      title: "Find runs",
      description:
        "Page run history for an authorized project inside an explicit startedAfter/startedBefore window (max 31 days). Filter by workflow, status, externalId (customer id) or internal run id via cursor pages; unsupported cursors fail closed.",
      inputSchema: fromJsonSchema(findRunsInputJsonSchema),
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async (input: unknown) => runMcpTool(findRunsForMcp(identity, input)),
  )
}

export const registerFlowmarkTools = (
  server: McpServer,
  identity: FlowmarkMcpAuthInfo,
) => {
  registerConnectionTool(server, identity)
  registerListWorkflowsTool(server, identity)
  registerFindRunsTool(server, identity)
}

export const createFlowmarkMcpSdkHandler = (
  runtime: ResolvedAgentAccessRuntime,
) => {
  let cached: ReturnType<typeof createMcpHandler> | undefined
  return () => {
    if (!cached) {
      cached = createMcpHandler(async (ctx) => {
        const identity = ctx.authInfo?.extra as FlowmarkMcpAuthInfo | undefined
        if (!identity) {
          throw new Error("Agent access context is missing.")
        }
        const server = new McpServer(
          { name: "flowmark", version: "0.1.0" },
          { capabilities: { tools: {} } },
        )
        registerFlowmarkTools(server, identity)
        return server
      })
    }
    void runtime
    return cached
  }
}
