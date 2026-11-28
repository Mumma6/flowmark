import { requireAgentAccessProjectId } from "@flowmark/auth/agent-access"
import {
  StoredCoverageInputSchema,
  assessCoverage,
  type GetProjectWorkflowData,
} from "@flowmark/api"
import { Effect, Schema } from "effect"
import type { FlowmarkMcpAuthInfo } from "../../auth/claims.js"
import { McpToolInputError, McpToolReadError } from "../../errors.js"
import { resolveMcpGrantFamily } from "../delegated/grant-family.js"
import { mcpDelegatedReader } from "../delegated/reader.js"

const ClientInput = Schema.Struct({
  version: Schema.Literal(2),
  projectId: Schema.String.check(Schema.isUUID()),
  ...StoredCoverageInputSchema.fields,
})

export const AssessCoverageSchema = ClientInput

export const assessCoverageForMcp = Effect.fn("AssessCoverage.execute")(
  function* (identity: FlowmarkMcpAuthInfo, raw: unknown) {
    const input = yield* Schema.decodeUnknownEffect(ClientInput, {
      onExcessProperty: "error",
    })(raw).pipe(
      Effect.mapError(
        () =>
          new McpToolInputError({
            reason:
              "Supply version 2, an authorized project, one question, its population and the observation window.",
          }),
      ),
    )
    yield* requireAgentAccessProjectId("assess_coverage", input.projectId)
    const family = yield* resolveMcpGrantFamily(identity)
    const { version, projectId, ...request } = input
    const assessment = yield* assessCoverage(
      mcpDelegatedReader(identity, family.familyId, projectId),
      request,
    ).pipe(
      Effect.mapError(
        () =>
          new McpToolReadError({
            reason: "Scoped coverage observations could not be read.",
          }),
      ),
    )
    return {
      tool: "assess_coverage" as const,
      version,
      projectId,
      assessment,
    }
  },
)

export type AssessCoverageRequirements = GetProjectWorkflowData
