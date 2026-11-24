import { requireAgentAccessProjectId } from "@flowmark/auth/agent-access"
import {
  StoredObservationRepairSchema,
  proposeObservationRepair,
} from "@flowmark/api"
import { Effect, Schema } from "effect"
import type { FlowmarkMcpAuthInfo } from "../../auth/claims.js"
import { McpToolInputError, McpToolReadError } from "../../errors.js"
import { resolveMcpGrantFamily } from "../delegated/grant-family.js"
import { mcpDelegatedReader } from "../delegated/reader.js"

export const ProposeObservationRepairSchema = Schema.Struct({
  version: Schema.Literal(1),
  projectId: Schema.String.check(Schema.isUUID()),
  ...StoredObservationRepairSchema.fields,
})

export const proposeObservationRepairForMcp = Effect.fn(
  "ProposeObservationRepair.execute",
)(function* (identity: FlowmarkMcpAuthInfo, raw: unknown) {
  if (typeof raw === "object" && raw !== null && Object.hasOwn(raw, "gap")) {
    return yield* new McpToolInputError({
      reason: "A caller-supplied diagnosis is not accepted.",
    })
  }
  const input = yield* Schema.decodeUnknownEffect(
    ProposeObservationRepairSchema,
    { onExcessProperty: "error" },
  )(raw).pipe(
    Effect.mapError(
      () =>
        new McpToolInputError({
          reason:
            "Supply version 1, an authorized project, the question, repository, approved namespaces, candidate reporting sites, access and traffic.",
        }),
    ),
  )
  yield* requireAgentAccessProjectId(
    "propose_observation_repair",
    input.projectId,
  )
  const family = yield* resolveMcpGrantFamily(identity)
  const reader = mcpDelegatedReader(identity, family.familyId, input.projectId)
  const { version, projectId, ...request } = input
  const proposal = yield* proposeObservationRepair(reader, request).pipe(
    Effect.catchTag("InvalidInput", (invalid) =>
      Effect.fail(
        new McpToolReadError({
          reason: String(invalid.cause),
          cause: invalid,
        }),
      ),
    ),
    Effect.mapError(
      (error) =>
        new McpToolReadError({
          reason: "Stored question evidence could not be read.",
          cause: error,
        }),
    ),
  )
  return {
    tool: "propose_observation_repair",
    version,
    projectId,
    repository: request.repository,
    proposal,
  }
})
