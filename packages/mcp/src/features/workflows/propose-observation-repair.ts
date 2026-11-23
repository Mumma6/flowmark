import { requireAgentAccessProjectId } from "@flowmark/auth/agent-access"
import {
  ObservationRepairInputSchema,
  proposeObservationRepair,
} from "@flowmark/api"
import { Effect, Schema } from "effect"
import type { FlowmarkMcpAuthInfo } from "../../auth/claims.js"
import { McpToolInputError } from "../../errors.js"

export const ProposeObservationRepairSchema = Schema.Struct({
  version: Schema.Literal(1),
  projectId: Schema.String.check(Schema.isUUID()),
  ...ObservationRepairInputSchema.fields,
})

export const proposeObservationRepairForMcp = Effect.fn(
  "ProposeObservationRepair.execute",
)(function* (identity: FlowmarkMcpAuthInfo, raw: unknown) {
  const input = yield* Schema.decodeUnknownEffect(
    ProposeObservationRepairSchema,
    { onExcessProperty: "error" },
  )(raw).pipe(
    Effect.mapError(
      () =>
        new McpToolInputError({
          reason:
            "Supply version 1, an authorized project, and one diagnosed question gap.",
        }),
    ),
  )
  yield* requireAgentAccessProjectId(
    "propose_observation_repair",
    input.projectId,
  )
  const proposal = yield* proposeObservationRepair(input).pipe(
    Effect.mapError(
      () =>
        new McpToolInputError({
          reason: "The repair input is outside the supported contract.",
        }),
    ),
  )
  return {
    tool: "propose_observation_repair",
    version: input.version,
    projectId: input.projectId,
    repository: input.repository,
    proposal,
  }
})
