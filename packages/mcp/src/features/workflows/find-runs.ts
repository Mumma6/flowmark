import type { AuthorizeAgentRead } from "@flowmark/api"
import { GetProjectWorkflowData } from "@flowmark/api"
import { Effect } from "effect"
import type { FlowmarkMcpAuthInfo } from "../../auth/claims.js"
import { McpToolReadError } from "../../errors.js"
import { assertHistoryWindow } from "../../tools/response.js"
import { decodeFindRunsInput } from "../../tools/schemas.js"
import { resolveMcpGrantFamily } from "../delegated/grant-family.js"
import { mcpDelegatedReader } from "../delegated/reader.js"
import type { McpToolFailure } from "../../tools/response.js"
import type { McpFindRunsResult } from "./types.js"

export const findRunsForMcp: (
  identity: FlowmarkMcpAuthInfo,
  rawInput: unknown,
) => Effect.Effect<
  McpFindRunsResult,
  McpToolFailure,
  GetProjectWorkflowData | AuthorizeAgentRead
> = Effect.fn("McpFindRuns.execute")(function* (
  identity: FlowmarkMcpAuthInfo,
  rawInput: unknown,
) {
  const input = yield* decodeFindRunsInput(rawInput)
  yield* assertHistoryWindow(input.startedAfter, input.startedBefore)
  const family = yield* resolveMcpGrantFamily(identity)
  const reader = mcpDelegatedReader(identity, family.familyId, input.projectId)
  const queries = yield* GetProjectWorkflowData
  const page = yield* queries
    .listRuns(reader, {
      workflow: input.workflow,
      status: input.status,
      search: input.search,
      externalId: input.externalId,
      correlationId: input.correlationId,
      parentRunId: input.parentRunId,
      environment: input.environment,
      release: input.release,
      failCode: input.failCode,
      namespace: input.namespace,
      startedAfter: input.startedAfter,
      startedBefore: input.startedBefore,
      cursor: input.cursor,
      limit: input.limit,
    })
    .pipe(
      Effect.catchTags({
        PersistenceError: () =>
          Effect.fail(
            new McpToolReadError({
              reason: "Run search could not be read.",
            }),
          ),
      }),
    )
  return {
    tool: "find_runs",
    projectId: input.projectId,
    appliedWindow: {
      startedAfter: input.startedAfter,
      startedBefore: input.startedBefore,
    },
    page,
    idFields: {
      runId: "runs[].id",
      externalId: "runs[].externalId",
    },
  } satisfies McpFindRunsResult
})
