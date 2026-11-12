import { AGENT_ACCESS_EXECUTION_BOUNDS as bounds } from "@flowmark/auth/agent-access"
import {
  ApiLive,
  ApiReadBudget,
  type GetMcpAgentConnection,
  type AuthorizeAgentRead,
  type GetProjectWorkflowData,
} from "@flowmark/api"
import { Effect } from "effect"
import { McpToolReadError } from "../errors.js"
import type { FlowmarkMcpAuthInfo } from "../auth/claims.js"
import { presentMcpTool, type McpToolFailure } from "../tools/response.js"
import { admitTool } from "./admission.js"

/** Only the MCP request boundary owns its deadline, cancellation and SQL policy. */
export const runMcpTool = <A extends Record<string, unknown>>(
  identity: FlowmarkMcpAuthInfo,
  input: unknown,
  projectScoped: boolean,
  operation: Effect.Effect<
    A,
    McpToolFailure,
    GetProjectWorkflowData | GetMcpAgentConnection | AuthorizeAgentRead
  >,
  signal?: AbortSignal,
) =>
  Effect.runPromiseExit(
    presentMcpTool(
      admitTool(identity, input, projectScoped).pipe(
        Effect.andThen(operation),
        Effect.timeoutOrElse({
          duration: bounds.toolTimeoutMs,
          orElse: () =>
            Effect.fail(
              new McpToolReadError({
                reason:
                  "The read deadline was exceeded. Narrow the query or retry.",
              }),
            ),
        }),
      ),
    ).pipe(
      Effect.provide(ApiLive),
      Effect.provideService(ApiReadBudget, {
        statementTimeoutMs: bounds.statementTimeoutMs,
        maxOperationFacts: 1000,
      }),
    ),
    { signal },
  )

/** Static UI resources share live grant admission/deadlines, with a separate build-time asset budget. */
export const runMcpResourceRead = (
  identity: FlowmarkMcpAuthInfo,
  signal?: AbortSignal,
) =>
  Effect.runPromiseExit(
    admitTool(identity, {}, false).pipe(
      Effect.timeoutOrElse({
        duration: bounds.toolTimeoutMs,
        orElse: () =>
          Effect.fail(
            new McpToolReadError({
              reason: "Resource admission deadline exceeded.",
            }),
          ),
      }),
      Effect.provide(ApiLive),
      Effect.provideService(ApiReadBudget, {
        statementTimeoutMs: bounds.statementTimeoutMs,
        maxOperationFacts: 1000,
      }),
    ),
    { signal },
  )
