import { requireAgentAccessProjectId } from "@flowmark/auth/agent-access"
import {
  QuestionMaintenanceInputSchema,
  maintainQuestionRepair,
} from "@flowmark/api"
import { Effect, Schema } from "effect"
import type { FlowmarkMcpAuthInfo } from "../../auth/claims.js"
import { McpToolInputError } from "../../errors.js"

export const MaintainQuestionSchema = Schema.Struct({
  version: Schema.Literal(1),
  projectId: Schema.String.check(Schema.isUUID()),
  ...QuestionMaintenanceInputSchema.fields,
})

export const maintainQuestionForMcp = Effect.fn("MaintainQuestion.execute")(
  function* (identity: FlowmarkMcpAuthInfo, raw: unknown) {
    const input = yield* Schema.decodeUnknownEffect(MaintainQuestionSchema, {
      onExcessProperty: "error",
    })(raw).pipe(
      Effect.mapError(
        () =>
          new McpToolInputError({
            reason:
              "Supply version 1, an authorized project, and one question with its source and traffic status.",
          }),
      ),
    )
    yield* requireAgentAccessProjectId("maintain_questions", input.projectId)
    const maintenance = yield* maintainQuestionRepair(input).pipe(
      Effect.mapError(
        () =>
          new McpToolInputError({
            reason: "The maintenance input is outside the supported contract.",
          }),
      ),
    )
    return {
      tool: "maintain_questions" as const,
      version: input.version,
      projectId: input.projectId,
      repository: input.repository,
      maintenance,
    }
  },
)
