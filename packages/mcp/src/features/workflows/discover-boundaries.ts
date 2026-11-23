import { requireAgentAccessProjectId } from "@flowmark/auth/agent-access"
import {
  DeployedBoundarySchema,
  EvidenceEstateInputSchema,
  discoverEvidenceBoundaries,
  GetProjectWorkflowData,
} from "@flowmark/api"
import { Effect, Schema } from "effect"
import type { FlowmarkMcpAuthInfo } from "../../auth/claims.js"
import { McpToolInputError, McpToolReadError } from "../../errors.js"
import { resolveMcpGrantFamily } from "../delegated/grant-family.js"
import { mcpDelegatedReader } from "../delegated/reader.js"

const RepositoryName = Schema.String.check(
  Schema.isPattern(/^[a-zA-Z0-9][a-zA-Z0-9._/-]{0,127}$/),
)

export const DiscoverBoundariesSchema = Schema.Struct({
  version: Schema.Literal(1),
  projectId: Schema.String.check(Schema.isUUID()),
  repository: RepositoryName,
  environment: Schema.optional(
    Schema.String.check(Schema.isPattern(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/)),
  ),
  source: EvidenceEstateInputSchema.fields.source,
  independentInventory: Schema.Array(
    Schema.Struct({
      ...DeployedBoundarySchema.fields,
      provenance: Schema.Literal("independent-inventory"),
    }),
  ).check(Schema.isMaxLength(24)),
  previous: EvidenceEstateInputSchema.fields.previous,
})

export const discoverBoundariesForMcp = Effect.fn("DiscoverBoundaries.execute")(
  function* (identity: FlowmarkMcpAuthInfo, raw: unknown) {
    const input = yield* Schema.decodeUnknownEffect(DiscoverBoundariesSchema, {
      onExcessProperty: "error",
    })(raw).pipe(
      Effect.mapError(
        () =>
          new McpToolInputError({
            reason:
              "Supply version 1, an authorized project and repository, and at most 24 source or deployed boundaries.",
          }),
      ),
    )
    yield* requireAgentAccessProjectId("discover_boundaries", input.projectId)
    const family = yield* resolveMcpGrantFamily(identity)
    const estate = yield* discoverEvidenceBoundaries(
      mcpDelegatedReader(identity, family.familyId, input.projectId),
      input,
    ).pipe(
      Effect.catchTag("PersistenceError", () =>
        Effect.fail(
          new McpToolReadError({
            reason: "Deployment inventory could not be read.",
          }),
        ),
      ),
    )
    return {
      tool: "discover_boundaries",
      version: input.version,
      projectId: input.projectId,
      repository: input.repository,
      environment: input.environment ?? null,
      ...estate,
    }
  },
)

export type DiscoverBoundariesRequirements = GetProjectWorkflowData
