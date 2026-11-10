import { GetProjectWorkflowData } from "@flowmark/api"
import {
  createMcpHandler,
  fromJsonSchema,
  McpServer,
} from "@modelcontextprotocol/server"
import {
  registerRunEvidenceTool,
  registerEvidenceResource,
} from "./evidence-resource.js"
import { Effect, Exit } from "effect"
import type { FlowmarkMcpAuthInfo } from "../../auth/claims.js"
import type { ResolvedAgentAccessRuntime } from "../../runtime/agent-access-runtime.js"
import { compareRunForMcp } from "../workflows/compare-run.js"
import { findRunsForMcp } from "../workflows/find-runs.js"
import { getRunForMcp } from "../workflows/get-run.js"
import { getWorkflowInsightsForMcp } from "../workflows/get-workflow-insights.js"
import { listWorkflowsForMcp } from "../workflows/list-workflows.js"
import { McpWorkflowTools } from "../workflows/workflow-tools.js"
import { mcpToolError, type McpToolFailure } from "../../tools/response.js"
import {
  connectionInputJsonSchema,
  compareRunInputJsonSchema,
  findRunsInputJsonSchema,
  getRunInputJsonSchema,
  listWorkflowsInputJsonSchema,
  workflowInsightsInputJsonSchema,
} from "../../tools/tool-input-json-schema.js"
import { runMcpResourceRead, runMcpTool } from "../../runtime/tool-runtime.js"
import { readPagedTool } from "../../tools/paged-read.js"
import { resolveMcpConnection } from "./resolve-connection.js"

const toolResult = <A, E>(exit: Exit.Exit<A, E>) =>
  Exit.match(exit, {
    onSuccess: (value) => value,
    onFailure: () => mcpToolError("The workflow read could not be completed."),
  })

const runWorkflowTool = async <A extends Record<string, unknown>>(
  identity: FlowmarkMcpAuthInfo,
  input: unknown,
  use: (tools: {
    readonly listWorkflows: typeof listWorkflowsForMcp
    readonly findRuns: typeof findRunsForMcp
    readonly getRun: typeof getRunForMcp
    readonly compareRun: typeof compareRunForMcp
    readonly getWorkflowInsights: typeof getWorkflowInsightsForMcp
  }) => Effect.Effect<A, McpToolFailure, GetProjectWorkflowData>,
  signal?: AbortSignal,
) =>
  toolResult(
    await runMcpTool(
      identity,
      input,
      true,
      McpWorkflowTools.use(use).pipe(Effect.provide(McpWorkflowTools.layer)),
      signal,
    ),
  )

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
      inputSchema: fromJsonSchema(connectionInputJsonSchema),
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async (_input, extra) =>
      toolResult(
        await runMcpTool(
          identity,
          {},
          false,
          resolveMcpConnection(identity),
          extra.mcpReq.signal,
        ),
      ),
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
    async (input: unknown, extra) =>
      runWorkflowTool(
        identity,
        input,
        (tools) =>
          readPagedTool(input, (page) => tools.listWorkflows(identity, page)),
        extra.mcpReq.signal,
      ),
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
    async (input: unknown, extra) =>
      runWorkflowTool(
        identity,
        input,
        (tools) =>
          readPagedTool(input, (page) => tools.findRuns(identity, page)),
        extra.mcpReq.signal,
      ),
  )
}

const registerGetRunTool = (
  server: McpServer,
  identity: FlowmarkMcpAuthInfo,
  uiSupported: boolean,
) => {
  return registerRunEvidenceTool(
    server,
    {
      title: "Get run",
      description:
        "Read one authorized run as a compact summary plus one bounded page. section is events (default), related, expectations, or operations. Continue with nextCursor. Run status, recorded duration, and operation status stay distinct.",
      inputSchema: fromJsonSchema(getRunInputJsonSchema),
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async (input: unknown, extra) =>
      runWorkflowTool(
        identity,
        input,
        (tools) => readPagedTool(input, (page) => tools.getRun(identity, page)),
        extra.mcpReq.signal,
      ),
    uiSupported,
  )
}

const registerCompareRunTool = (
  server: McpServer,
  identity: FlowmarkMcpAuthInfo,
) => {
  server.registerTool(
    "compare_run",
    {
      title: "Compare run",
      description:
        "Compare one authorized run with the existing peer population. Optional peers uses the same selection as Studio (days 1–90, environment, release, one dimension). Durations are recorded durations, not wall time.",
      inputSchema: fromJsonSchema(compareRunInputJsonSchema),
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async (input: unknown, extra) =>
      runWorkflowTool(
        identity,
        input,
        (tools) => tools.compareRun(identity, input),
        extra.mcpReq.signal,
      ),
  )
}

const registerWorkflowInsightsTool = (
  server: McpServer,
  identity: FlowmarkMcpAuthInfo,
) => {
  server.registerTool(
    "get_workflow_insights",
    {
      title: "Get workflow insights",
      description:
        "Read one insight mode for an authorized project. mode technical uses the existing period report. mode business uses the existing declared-result insights. Windows are canonical UTC and at most 31 days. Environment and other run filters are rejected rather than dropped. Counts and coverage come from those aggregates; this tool does not infer causes or fill missing history.",
      inputSchema: fromJsonSchema(workflowInsightsInputJsonSchema),
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async (input: unknown, extra) =>
      runWorkflowTool(
        identity,
        input,
        (tools) => tools.getWorkflowInsights(identity, input),
        extra.mcpReq.signal,
      ),
  )
}

export const registerFlowmarkTools = (
  server: McpServer,
  identity: FlowmarkMcpAuthInfo,
  uiSupported = false,
) => {
  registerConnectionTool(server, identity)
  registerListWorkflowsTool(server, identity)
  registerFindRunsTool(server, identity)
  registerGetRunTool(server, identity, uiSupported)
  registerEvidenceResource(server, async (signal) => {
    const admitted = await runMcpResourceRead(identity, signal)
    Exit.match(admitted, {
      onSuccess: () => undefined,
      onFailure: () => {
        throw new Error("Evidence resource access denied or unavailable.")
      },
    })
  })
  registerCompareRunTool(server, identity)
  registerWorkflowInsightsTool(server, identity)
}

export const createFlowmarkMcpSdkHandler = (
  runtime: ResolvedAgentAccessRuntime,
) => {
  const handlers = new Map<boolean, ReturnType<typeof createMcpHandler>>()
  return (uiSupported = false) => {
    const cached = handlers.get(uiSupported)
    if (cached) {
      return cached
    }
    const handler = createMcpHandler(async (ctx) => {
      const identity = ctx.authInfo?.extra as FlowmarkMcpAuthInfo | undefined
      if (!identity) {
        throw new Error("Agent access context is missing.")
      }
      const server = new McpServer(
        { name: "flowmark", version: "0.1.0" },
        { capabilities: { tools: {}, resources: {} } },
      )
      registerFlowmarkTools(server, identity, uiSupported)
      return server
    })
    handlers.set(uiSupported, handler)
    void runtime
    return handler
  }
}
