import { requireAgentAccessProjectId } from "@flowmark/auth/agent-access"
import {
  ReleaseEvaluationInputSchema,
  evaluateReleaseChange,
} from "@flowmark/api"
import { Effect, Schema } from "effect"
import type { FlowmarkMcpAuthInfo } from "../../auth/claims.js"
import { McpToolInputError } from "../../errors.js"

export const EvaluateReleaseSchema = Schema.Struct({
  version: Schema.Literal(1),
  projectId: Schema.String.check(Schema.isUUID()),
  ...ReleaseEvaluationInputSchema.fields,
})

export const evaluateReleaseForMcp = Effect.fn("EvaluateRelease.execute")(
  function* (identity: FlowmarkMcpAuthInfo, raw: unknown) {
    const input = yield* Schema.decodeUnknownEffect(EvaluateReleaseSchema, {
      onExcessProperty: "error",
    })(raw).pipe(
      Effect.mapError(
        () =>
          new McpToolInputError({
            reason:
              "Supply version 1, an authorized project, and one reviewed release question.",
          }),
      ),
    )
    yield* requireAgentAccessProjectId("evaluate_release", input.projectId)
    const evaluation = yield* evaluateReleaseChange(input).pipe(
      Effect.mapError(
        () =>
          new McpToolInputError({
            reason: "The release input is outside the supported contract.",
          }),
      ),
    )
    return {
      tool: "evaluate_release" as const,
      version: input.version,
      projectId: input.projectId,
      evaluation,
    }
  },
)
