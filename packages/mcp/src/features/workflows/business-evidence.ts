import { GetBusinessEvidence, type ProjectReader } from "@flowmark/api"
import { Effect, Option } from "effect"
import { McpToolReadError } from "../../errors.js"
import type { BusinessEvidence } from "@flowmark/api"
export type McpBusinessResult = {
  readonly tool: string
  readonly projectId: string
  readonly evidence: BusinessEvidence
}
/** Branch on live authority before diagnostic reads or diagnostic resource construction. */
export const businessToolEvidence = Effect.fn("Mcp.businessEvidence")(
  function* (reader: ProjectReader, tool: string, selection: () => unknown) {
    const evidence = yield* GetBusinessEvidence
    const capability = yield* evidence.capabilities(reader).pipe(
      Effect.catchTag("PersistenceError", () =>
        Effect.fail(
          new McpToolReadError({
            reason: "Evidence access could not be checked.",
          }),
        ),
      ),
    )
    if (capability.depth !== "business") {
      return Option.none<McpBusinessResult>()
    }
    const projected = yield* evidence.read(reader, selection()).pipe(
      Effect.catchTag("PersistenceError", () =>
        Effect.fail(
          new McpToolReadError({
            reason: "Published evidence could not be read.",
          }),
        ),
      ),
    )
    return Option.some({
      tool,
      projectId: capability.projectId,
      evidence: projected,
    } satisfies McpBusinessResult)
  },
)
