import {
  businessToolEvidence,
  type McpBusinessResult,
} from "./business-evidence.js"
import type { AuthorizeAgentRead } from "@flowmark/api"
import { GetBusinessEvidence, GetProjectWorkflowData } from "@flowmark/api"
import { Effect, Option } from "effect"
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
  McpFindRunsResult | McpBusinessResult,
  McpToolFailure,
  GetProjectWorkflowData | GetBusinessEvidence | AuthorizeAgentRead
> = Effect.fn("McpFindRuns.execute")(function* (
  identity: FlowmarkMcpAuthInfo,
  rawInput: unknown,
) {
  const input = yield* decodeFindRunsInput(rawInput)
  yield* assertHistoryWindow(input.startedAfter, input.startedBefore)
  const family = yield* resolveMcpGrantFamily(identity)
  const reader = mcpDelegatedReader(identity, family.familyId, input.projectId)
  const business = yield* businessToolEvidence(reader, "find_runs", () => ({
    kind: "runs",
    query: {
      workflow: input.workflow,
      status: input.status,
      startedAfter: input.startedAfter,
      startedBefore: input.startedBefore,
      cursor: input.cursor,
      limit: input.limit,
      ...(input.search !== undefined ? { search: input.search } : {}),
      ...(input.externalId !== undefined
        ? { externalId: input.externalId }
        : {}),
      ...(input.correlationId !== undefined
        ? { correlationId: input.correlationId }
        : {}),
      ...(input.parentRunId !== undefined
        ? { parentRunId: input.parentRunId }
        : {}),
      ...(input.environment !== undefined
        ? { environment: input.environment }
        : {}),
      ...(input.release !== undefined ? { release: input.release } : {}),
      ...(input.failCode !== undefined ? { failCode: input.failCode } : {}),
      ...(input.namespace !== undefined ? { namespace: input.namespace } : {}),
    },
  }))
  if (Option.isSome(business)) {
    return business.value
  }
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
