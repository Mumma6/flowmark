import type { AuthorizeAgentRead } from "@flowmark/api"
import { GetProjectWorkflowData } from "@flowmark/api"
import { Effect, Option } from "effect"
import type { FlowmarkMcpAuthInfo } from "../../auth/claims.js"
import { McpToolReadError } from "../../errors.js"
import { decodeListWorkflowsInput } from "../../tools/schemas.js"
import { resolveMcpGrantFamily } from "../delegated/grant-family.js"
import { mcpDelegatedReader } from "../delegated/reader.js"
import type { McpToolFailure } from "../../tools/response.js"
import type { McpListWorkflowsResult } from "./types.js"

const readError = (reason: string) =>
  Effect.fail(new McpToolReadError({ reason }))

export const listWorkflowsForMcp: (
  identity: FlowmarkMcpAuthInfo,
  rawInput: unknown,
) => Effect.Effect<
  McpListWorkflowsResult,
  McpToolFailure,
  GetProjectWorkflowData | AuthorizeAgentRead
> = Effect.fn("McpListWorkflows.execute")(function* (
  identity: FlowmarkMcpAuthInfo,
  rawInput: unknown,
) {
  const input = yield* decodeListWorkflowsInput(rawInput)
  const family = yield* resolveMcpGrantFamily(identity)
  const reader = mcpDelegatedReader(identity, family.familyId, input.projectId)
  const queries = yield* GetProjectWorkflowData
  const discovery = yield* queries
    .discoverWorkflows(reader, {
      cursor: input.cursor,
      limit: input.limit,
    })
    .pipe(
      Effect.catchTags({
        PersistenceError: () =>
          readError("Workflow discovery could not be read."),
      }),
    )
  const meaning = yield* Option.match(Option.fromNullishOr(input.workflow), {
    onNone: () => Effect.succeed(Option.none()),
    onSome: (workflow) =>
      queries
        .discoverWorkflowMeaning(reader, {
          workflow,
          revision: input.revision,
          cursor: input.meaningCursor,
          limit: input.limit,
        })
        .pipe(
          Effect.catchTags({
            PersistenceError: () =>
              readError("Workflow meaning could not be read."),
          }),
          Effect.map(Option.some),
        ),
  })
  return {
    tool: "list_workflows",
    projectId: input.projectId,
    discovery,
    ...Option.match(meaning, {
      onNone: () => ({}),
      onSome: (page) => ({ meaning: page }),
    }),
  } satisfies McpListWorkflowsResult
})
