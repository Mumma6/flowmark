import { GetProjectWorkflowData } from "@flowmark/api"
import { Effect } from "effect"
import type { FlowmarkMcpAuthInfo } from "../../auth/claims.js"
import { McpToolReadError } from "../../errors.js"
import { decodeCompareRunInput } from "../../tools/schemas.js"
import type { McpToolFailure } from "../../tools/response.js"
import { resolveMcpGrantFamily } from "../delegated/grant-family.js"
import { mcpDelegatedReader } from "../delegated/reader.js"
import type { McpCompareRunResult } from "./types.js"

const readError = (reason: string) =>
  Effect.fail(new McpToolReadError({ reason }))

export const compareRunForMcp: (
  identity: FlowmarkMcpAuthInfo,
  rawInput: unknown,
) => Effect.Effect<
  McpCompareRunResult,
  McpToolFailure,
  GetProjectWorkflowData
> = Effect.fn("McpCompareRun.execute")(function* (
  identity: FlowmarkMcpAuthInfo,
  rawInput: unknown,
) {
  const input = yield* decodeCompareRunInput(rawInput)
  const family = yield* resolveMcpGrantFamily(identity)
  const reader = mcpDelegatedReader(identity, family.familyId, input.projectId)
  const queries = yield* GetProjectWorkflowData
  const comparison = yield* queries
    .compare(reader, input.runId, input.peers)
    .pipe(
      Effect.catchTags({
        PersistenceError: () => readError("Run comparison could not be read."),
      }),
    )
  return {
    tool: "compare_run",
    projectId: input.projectId,
    runId: input.runId,
    selection: input.peers ?? null,
    comparison,
    distinctions: {
      peerDuration:
        "Peer duration figures are medians of recorded durations, not wall-clock time.",
      operationDuration:
        "Occurrence duration and total recorded operation duration stay separate from the run duration.",
      operationStatus:
        "Operation status is completed, failed, open, or absent. It is not the run's terminal status.",
    },
  } satisfies McpCompareRunResult
})
