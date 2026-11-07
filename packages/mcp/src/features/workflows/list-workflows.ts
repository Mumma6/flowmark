import { GetProjectWorkflowData } from "@flowmark/api"
import { Effect } from "effect"
import type { FlowmarkMcpAuthInfo } from "../../auth/claims.js"
import { McpToolReadError } from "../../errors.js"
import { decodeListWorkflowsInput } from "../../tools/schemas.js"
import { resolveMcpGrantFamily } from "../delegated/grant-family.js"
import { mcpDelegatedReader } from "../delegated/reader.js"
import type { McpListWorkflowsResult } from "./types.js"

const mapReadError = (reason: string) => (error: { readonly _tag: string }) =>
  error._tag === "InvalidInput" || error._tag === "Unauthorized"
    ? error
    : new McpToolReadError({ reason })

export const listWorkflowsForMcp = (
  identity: FlowmarkMcpAuthInfo,
  rawInput: unknown,
): Effect.Effect<McpListWorkflowsResult, unknown, GetProjectWorkflowData> =>
  Effect.fn("McpListWorkflows.execute")(function* () {
    const input = yield* decodeListWorkflowsInput(rawInput)
    const family = yield* resolveMcpGrantFamily(identity)
    const reader = mcpDelegatedReader(
      identity,
      family.familyId,
      input.projectId,
    )
    const queries = yield* GetProjectWorkflowData
    const discovery = yield* queries
      .discoverWorkflows(reader, {
        cursor: input.cursor,
        limit: input.limit,
      })
      .pipe(
        Effect.mapError(mapReadError("Workflow discovery could not be read.")),
      )
    const meaning =
      input.workflow === undefined
        ? undefined
        : yield* queries
            .discoverWorkflowMeaning(reader, {
              workflow: input.workflow,
              revision: input.revision,
              cursor: input.meaningCursor,
              limit: input.limit,
            })
            .pipe(
              Effect.mapError(
                mapReadError("Workflow meaning could not be read."),
              ),
            )
    return {
      tool: "list_workflows",
      projectId: input.projectId,
      discovery,
      ...(meaning === undefined ? {} : { meaning }),
    } satisfies McpListWorkflowsResult
  })()
